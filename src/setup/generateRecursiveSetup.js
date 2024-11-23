
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');

const pil2circom = require('stark-recurser/src/pil2circom/pil2circom.js');
const {compressorSetup} = require('stark-recurser/src/circom2pil/compressor_setup');
const {genCircom} = require('stark-recurser/src/gencircom.js');
const { genNullProof } = require('stark-recurser/src/pil2circom/proof2zkin');

const { runWitnessLibraryGeneration } = require('./generateWitness');

const { starkSetup } = require('./pil2-stark/stark_setup.js');

const { AirOut } = require('../airout.js');

module.exports.genRecursiveSetup = async function genRecursiveSetup(buildDir, setupOptions, template, airgroupName, airgroupId, airId, globalInfo, constRoot, verificationKeys = [], starkInfo, verifierInfo, starkStruct, compressorCols, hasCompressor) {

    let inputChallenges = false;
    let verkeyInput = false;
    let enableInput = false;
    let verifierName;
    let nameFilename;
    let filesDir;
    let constRootCircuit = constRoot || [];
    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
        let airName = globalInfo.airs[airgroupId][airId].name;
        inputChallenges = true;
        verifierName = `${airName}.verifier.circom`;
        nameFilename = `${airName}_${template}`;    
        filesDir = `${buildDir}/provingKey/${globalInfo.name}/${airgroupName}/airs/${airName}/${template}`;
    } else if(template === "recursive1") {
        let airName = globalInfo.airs[airgroupId][airId].name;
        verifierName = `${airName}_compressor.verifier.circom`;
        nameFilename = `${airName}_${template}`;
        filesDir = `${buildDir}/provingKey/${globalInfo.name}/${airgroupName}/airs/${airName}/recursive1/`;
    } else if (template === "recursive2") {
        verifierName = `${airgroupName}_recursive2.verifier.circom`;
        nameFilename = `${airgroupName}_${template}`;
        filesDir = `${buildDir}/provingKey/${globalInfo.name}/${airgroupName}/${template}`;
        enableInput = (globalInfo.air_groups.length > 1 || globalInfo.airs[0].length > 1)  ? true : false;
        verkeyInput = true;
    } else {
        throw new Error("Unknown template" + template);
    }

    const options = { skipMain: true, verkeyInput, enableInput, inputChallenges, airgroupId, hasCompressor }
        
    await fs.promises.mkdir(`${buildDir}/circom/`, { recursive: true });
    await fs.promises.mkdir(`${buildDir}/build/`, { recursive: true });
    await fs.promises.mkdir(`${buildDir}/pil/`, { recursive: true });
    await fs.promises.mkdir(filesDir, { recursive: true });

    await pil2circom(`${buildDir}/circom/${verifierName}`, constRootCircuit, starkInfo, verifierInfo, options);

    await genCircom(`${buildDir}/circom/${nameFilename}.circom`, buildDir, "vadcop", template, [starkInfo], globalInfo, [verifierName], verificationKeys, [], [], options);

    // Generate witness library
    runWitnessLibraryGeneration(buildDir, filesDir, nameFilename, template);

    const pil2 = false;

    // Generate pilout
    const { pilout } = await compressorSetup(`${buildDir}/build/${nameFilename}.r1cs`, `${filesDir}/${template}.const`, `${filesDir}/${template}.exec`, `${buildDir}/pil/${nameFilename}.pil`, compressorCols, pil2, { stdPath: setupOptions.stdlib });

    let pilRecursive = pil2 ? new AirOut("", pilout).airGroups[0].airs[0] : pilout;
  
    const setup = await starkSetup(pilRecursive, starkStruct, {...setupOptions, pil2: false, airgroupId, airId, recursion: true});

    await fs.promises.writeFile(`${filesDir}/${template}.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    console.log("Computing Constant Tree...");
    await exec(`${setupOptions.constTree} -c ${filesDir}/${template}.const -s ${filesDir}/${template}.starkinfo.json -v ${filesDir}/${template}.verkey.json`);
    setup.constRoot = JSONbig.parse(await fs.promises.readFile(`${filesDir}/${template}.verkey.json`, "utf8"));
    
    console.log("Computing Bin File...");
    await exec(`${setupOptions.binFile} -s ${filesDir}/${template}.starkinfo.json -e ${filesDir}/${template}.expressionsinfo.json -b ${filesDir}/${template}.bin`);
    
    if(template === "recursive2") {
        const vks = {
            rootCRecursives1: verificationKeys,
            rootCRecursive2: setup.constRoot,
        }
        await fs.promises.writeFile(`${filesDir}/${template}.vks.json`, JSONbig.stringify(vks, 0, 1), "utf8");
        
        if(globalInfo.aggTypes.length > 1) {
            const nullProof = genNullProof(setup.starkInfo);
            await fs.promises.writeFile(`${buildDir}/provingKey/${globalInfo.name}/${airgroupName}/recursive2/recursive2.null_zkin.json`, JSON.stringify(nullProof, 0, 1), "utf8");
        }
    }

    return { constRoot: setup.constRoot, starkInfo: setup.starkInfo, verifierInfo: setup.verifierInfo }

}