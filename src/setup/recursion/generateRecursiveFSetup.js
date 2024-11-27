const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');

const { compressorSetup } = require('stark-recurser/src/circom2pil/compressor_setup.js');
const { genCircom } = require('stark-recurser/src/gencircom.js');
const pil2circom = require('stark-recurser/src/pil2circom/pil2circom.js');
const path = require("path");
const { runWitnessLibraryGeneration, runWitnessLibraryGenerationAwait } = require("../generateWitness");

const F3g = require("../../pil2-stark/utils/f3g.js");
const {starkSetup} = require("../../pil2-stark/stark_setup");
const { writeExpressionsBinFile } = require("../../pil2-stark/chelpers/binFile.js");
const { generateStarkStruct } = require('../utils.js');

module.exports.genRecursiveFSetup = async function genRecursiveFSetup(buildDir, setupOptions, template, globalInfo, constRoot, verificationKeys = [], starkInfo, verifierInfo, compressorCols) {
    const F = new F3g();

    let verifierName = "vadcop_final.verifier.circom";
    let nameFilename = "recursivef";
    let templateFilename = path.resolve(__dirname,"../../../", `node_modules/stark-recurser/src/recursion/templates/recursivef.circom.ejs`);
    let filesDir = `${buildDir}/provingKey/${globalInfo.name}/${template}`;
    
    await fs.promises.mkdir(filesDir, { recursive: true });

    const options = { skipMain: true, verkeyInput: false, enableInput: false, hasRecursion: false }
        
    //Generate circom
    const verifierCircomTemplate = await pil2circom(constRoot, starkInfo, verifierInfo, options);
    await fs.promises.writeFile(`${buildDir}/circom/${verifierName}`, verifierCircomTemplate, "utf8");

    const recursiveVerifier = await genCircom(templateFilename, [starkInfo], globalInfo, [verifierName], verificationKeys, [], [], options);
    await fs.promises.writeFile(`${buildDir}/circom/${nameFilename}.circom`, recursiveVerifier, "utf8");
 
    const circuitsGLPath = path.resolve(__dirname, '../../../', 'node_modules/stark-recurser/src/pil2circom/circuits.gl');
    const starkRecurserCircuits = path.resolve(__dirname, '../../../', 'node_modules/stark-recurser/src/recursion/helpers/circuits');
 
    // Compile circom
    console.log("Compiling " + nameFilename + "...");
    const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --c --verbose -l ${starkRecurserCircuits} -l ${circuitsGLPath} ${buildDir}/circom/${nameFilename}.circom -o ${buildDir}/build`;
    await exec(compileRecursiveCommand);
 
    console.log("Copying circom files...");
    fs.copyFile(`${buildDir}/build/${nameFilename}_cpp/${nameFilename}.dat`, `${filesDir}/${template}.dat`, (err) => { if(err) throw err; });
     
    // Generate witness library
    await runWitnessLibraryGenerationAwait(buildDir, filesDir, nameFilename, template);
 
    // Generate setup
    const {exec: execBuff, pilStr, constPols, nBits} = await compressorSetup(F, `${buildDir}/build/${nameFilename}.r1cs`, compressorCols);
 
    await constPols.saveToFile(`${filesDir}/${template}.const`);

    const fd =await fs.promises.open(`${filesDir}/${template}.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    await fs.promises.writeFile(`${buildDir}/pil/${nameFilename}.pil`, pilStr, "utf8");

    // Build stark info
    const pilRecursive = await compile(F, `${buildDir}/pil/${nameFilename}.pil`);

    const starkStructSettings = { blowupFactor: 4, verificationHashType: "BN128", merkleTreeArity: 4, merkleTreeCustom: false };
    const starkStructRecursiveF = generateStarkStruct(starkStructSettings, nBits);

    const setup = await starkSetup(pilRecursive, starkStructRecursiveF, {...setupOptions, F, pil2: false, recursion: true});

    await fs.promises.writeFile(`${filesDir}/${template}.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    console.log("Computing Constant Tree...");
    await exec(`${setupOptions.constTree} -c ${filesDir}/${template}.const -s ${filesDir}/${template}.starkinfo.json -v ${filesDir}/${template}.verkey.json`);
    setup.constRoot = JSONbig.parse(await fs.promises.readFile(`${filesDir}/${template}.verkey.json`, "utf8"));
    
    await writeExpressionsBinFile(`${filesDir}/${template}.bin`, setup.starkInfo, setup.expressionsInfo);
     
    return {starkInfoFinal: setup.starkInfo, verifierInfoFinal: setup.verifierInfo, constRootFinal: setup.constRoot};
}