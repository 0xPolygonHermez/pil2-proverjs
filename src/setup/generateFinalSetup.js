const {readR1cs} = require("r1csfile");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');

const F3g = require('pil2-stark-js/src/helpers/f3g');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { starkSetup } = require('pil2-stark-js');

const { compressorSetup } = require('stark-recurser/src/circom2pil/compressor_setup.js');
const { genCircom } = require('stark-recurser/src/gencircom.js');
const { generateStarkStruct } = require("./utils");
const path = require("path");
const { prepareExpressionsBin } = require("pil2-stark-js/src/stark/chelpers/stark_chelpers");
const { writeExpressionsBinFile } = require("pil2-stark-js/src/stark/chelpers/binFile");
const { runFinalWitnessLibraryGeneration } = require("./generateWitness");

module.exports.genFinalSetup = async function genFinalSetup(buildDir, setupOptions, finalSettings, globalInfo, globalConstraints, compressorCols) {
    const F = new F3g();

    const starkInfos = [];
    const verifierInfos = [];
    const aggregatedKeysRecursive2 = [];
    const basicKeysRecursive1 = [];
    const verifierNames = [];

    const finalFilename = `${buildDir}/circom/final.circom`;

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

    let templateFilename = path.resolve(__dirname, "../..", `node_modules/stark-recurser/src/vadcop/templates/final.circom.ejs`);

    // Generate final circom
    const finalVerifier = await genCircom(templateFilename, starkInfos, {...globalInfo, globalConstraints: globalConstraints.constraints }, verifierNames, basicKeysRecursive1, aggregatedKeysRecursive2);
    await fs.promises.writeFile(finalFilename, finalVerifier, "utf8");


    const circuitsGLPath = path.resolve(__dirname, '../../', 'node_modules/pil2-stark-js/circuits.gl');
    const starkRecurserCircuits = path.resolve(__dirname, '../../', 'node_modules/stark-recurser/src/vadcop/helpers/circuits');

    // Compile circom
    console.log("Compiling " + finalFilename + "...");
    const compileFinalCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --c --verbose -l ${starkRecurserCircuits} -l ${circuitsGLPath} ${finalFilename} -o ${buildDir}/build`;
    const execCompile = await exec(compileFinalCommand);
    console.log(execCompile.stdout);
    
    console.log("Copying circom files...");
    fs.copyFile(`${buildDir}/build/final_cpp/final.dat`, `${buildDir}/provingKey/${globalInfo.name}/final/final.dat`, (err) => { if(err) throw err; });
    
    await runFinalWitnessLibraryGeneration(buildDir, filesDir);

    // Generate setup
    const finalR1csFile = `${buildDir}/build/final.r1cs`;
    const {exec: execBuff, pilStr, constPols, nBits } = await compressorSetup(F, finalR1csFile, compressorCols);

    const fd =await fs.promises.open(`${filesDir}/final.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    const pilFilename = `${buildDir}/pil/final.pil`
    await fs.promises.writeFile(pilFilename, pilStr, "utf8");

    // Compile pil
    const pilFinal = await compile(F, pilFilename);

    if(finalSettings.starkStruct && finalSettings.starkStruct.nBits !== nBits) {
        throw new Error("Final starkStruct nBits does not match with final circuit size");
    };

    let starkStructFinal = finalSettings.starkStruct || generateStarkStruct(finalSettings, nBits);
    
    // Build stark info
    const setup = await starkSetup(constPols, pilFinal, starkStructFinal, {...setupOptions, F, pil2: false, recursion: true});

    await constPols.saveToFile(`${filesDir}/final.const`);


    await fs.promises.writeFile(`${filesDir}/final.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");
    
    if(!setupOptions.constTree) {
        const MH = await buildMerkleHashGL();
        await MH.writeToFile(setup.constTree, `${filesDir}/final.consttree`);
        await fs.promises.writeFile(`${filesDir}/final.verkey.json`, JSONbig.stringify(setup.constRoot, null, 1), "utf8");
    } else {
        console.log("Computing Constant Tree...");
        const {stdout} = await exec(`${setupOptions.constTree} -c ${filesDir}/final.const -s ${filesDir}/final.starkinfo.json -t ${filesDir}/final.consttree -v ${filesDir}/final.verkey.json`);
        setup.constRoot = JSON.parse(await fs.promises.readFile(`${filesDir}/final.verkey.json`, "utf8"));
    }

    const expsBin = await prepareExpressionsBin(setup.starkInfo, setup.expressionsInfo);

    await writeExpressionsBinFile(`${filesDir}/final.bin`, expsBin);

    return {starkInfoFinal: setup.starkInfo, verifierInfoFinal: setup.verifierInfo, constRootFinal: setup.constRoot};
}