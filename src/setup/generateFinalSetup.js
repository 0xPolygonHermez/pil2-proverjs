const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');

const { compressorSetup } = require('stark-recurser/src/circom2pil/compressor_setup.js');
const { genCircom } = require('stark-recurser/src/gencircom.js');

const { generateStarkStruct } = require("./utils");
const { runFinalWitnessLibraryGeneration } = require("./generateWitness");

const {starkSetup} = require("./pil2-stark/stark_setup.js");

module.exports.genFinalSetup = async function genFinalSetup(buildDir, setupOptions, finalSettings, globalInfo, globalConstraints, compressorCols) {
    const starkInfos = [];
    const verifierInfos = [];
    const aggregatedKeysRecursive2 = [];
    const basicKeysRecursive1 = [];
    const verifierNames = [];

    for(let i = 0; i < globalInfo.aggTypes.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(`${buildDir}/provingKey/${globalInfo.name}/${globalInfo.air_groups[i]}/recursive2/recursive2.starkinfo.json`, "utf8"));
        const verifierInfo = JSON.parse(await fs.promises.readFile(`${buildDir}/provingKey/${globalInfo.name}/${globalInfo.air_groups[i]}/recursive2/recursive2.verifierinfo.json`, "utf8"));
        const verificationKeys = JSONbig.parse(await fs.promises.readFile(`${buildDir}/provingKey/${globalInfo.name}/${globalInfo.air_groups[i]}/recursive2/recursive2.vks.json`, "utf8"));

        starkInfos.push(starkInfo);
        verifierInfos.push(verifierInfo);
        aggregatedKeysRecursive2.push(verificationKeys.rootCRecursive2);
        basicKeysRecursive1.push(verificationKeys.rootCRecursives1);
        verifierNames.push( `${globalInfo.air_groups[i]}_recursive2.verifier.circom`);
    }
        
    const filesDir = `${buildDir}/provingKey/${globalInfo.name}/final`;
    await fs.promises.mkdir(filesDir, { recursive: true });

    // Generate final circom
    await genCircom(`${buildDir}/circom/final.circom`, buildDir, "vadcop", "final", starkInfos, {...globalInfo, globalConstraints: globalConstraints.constraints }, verifierNames, basicKeysRecursive1, aggregatedKeysRecursive2);
    
    await runFinalWitnessLibraryGeneration(buildDir, filesDir, globalInfo.name);

    const pil2 = false;

    // Generate setup
    const { nBits, pilout } = await compressorSetup(`${buildDir}/build/final.r1cs`, `${filesDir}/final.const`, `${filesDir}/final.exec`, `${buildDir}/pil/final.pil`, compressorCols, pil2, { stdPath: setupOptions.stdlib });

    if(finalSettings.starkStruct && finalSettings.starkStruct.nBits !== nBits) {
        throw new Error("Final starkStruct nBits does not match with final circuit size");
    };

    let starkStructFinal = finalSettings.starkStruct || generateStarkStruct(finalSettings, nBits);
    
    let pilFinal = pil2 ? new AirOut("", pilout).airGroups[0].airs[0] : pilout;
  
    // Build stark info
    const setup = await starkSetup(pilFinal, starkStructFinal, {...setupOptions, pil2, recursion: true});

    await fs.promises.writeFile(`${filesDir}/final.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");
    
    console.log("Computing Constant Tree...");
    const {stdout} = await exec(`${setupOptions.constTree} -c ${filesDir}/final.const -s ${filesDir}/final.starkinfo.json -v ${filesDir}/final.verkey.json`);
    setup.constRoot = JSON.parse(await fs.promises.readFile(`${filesDir}/final.verkey.json`, "utf8"));
    
    console.log("Computing Bin File...");
    await exec(`${setupOptions.binFile} -s ${filesDir}/final.starkinfo.json -e ${filesDir}/final.expressionsinfo.json -b ${filesDir}/final.bin`);

    return {starkInfoFinal: setup.starkInfo, verifierInfoFinal: setup.verifierInfo, constRootFinal: setup.constRoot};
}