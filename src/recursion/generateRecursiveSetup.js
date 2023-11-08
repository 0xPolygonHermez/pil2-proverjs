
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const F3g = require('pil2-stark-js/src/helpers/f3g');
const {compressorSetup} = require('pil2-stark-js/src/compressor/compressor_setup');
const { compile } = require('pilcom');
const { pilInfo } = require('pil2-stark-js');
const {buildConstTree} = require('pil2-stark-js/src/stark/stark_buildConstTree.js');
const pil2circom = require('pil2-stark-js/src/pil2circom');
const {genRecursive} = require('pil2-stark-js/recursive/genrecursive.js');


async function generateRecursiveSetup(template, subproofId, subproofName, constRoot, starkInfo, starkStruct, compressorCols, hasCompressor) {

    const F = new F3g();

    const recursiveName = `${template}_${subproofName}`;

    let hashCommits = false;
    let vadcop = false;
    let verkeyInput = false;
    let enableInput = false;
    let verifierFilename;
    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
      hashCommits = true;
      vadcop = true; 
      verifierFilename = `tmp/${subproofName}.verifier.circom`;
    } else {
        if(template === "recursive1") {
            verifierFilename = `tmp/compressor_${subproofName}.verifier.circom`;
        } else if (template === "recursive2") {
            verifierFilename = `tmp/recursive1_${subproofName}.verifier.circom`;
            enableInput = true;
            verkeyInput = true;
        } else if (template === "recursivef") {
            enableInput = true;
            verifierFilename = `tmp/recursive2_${subproofName}.verifier.circom`;
        } else if (template === "final") {
            verifierFilename = `tmp/recursivef_${subproofName}.verifier.circom`;
        }
    }

    //Generate circom
    const verifierCircomTemplate = await pil2circom(constRoot.constRoot, starkInfo, { hashCommits, vadcop, skipMain: true, verkeyInput, enableInput });
    await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

    // Generate recursive1 circom
    const globalInfo = JSON.parse(await fs.promises.readFile("tmp/globalInfo.json", "utf8"));
    const recursiveVerifier = await genRecursive(template, subproofId, subproofName, [constRoot.constRoot], starkInfo, globalInfo);
    const recursiveFilename = `tmp/${recursiveName}.circom`;
    await fs.promises.writeFile(recursiveFilename, recursiveVerifier, "utf8");


    // Compile circom
    const compileRecursive1Command = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --verbose -l node_modules/pil2-stark-js/circuits.gl tmp/${recursiveName}.circom -o tmp`;
    const execCompile = await exec(compileRecursive1Command);
    console.log(execCompile.stdout);

    // Generate setup
    const recursive1R1csFile = `tmp/${recursiveName}.r1cs`;
    const {exec: execBuff, pilStr, constPols} = await compressorSetup(F, recursive1R1csFile, compressorCols);

    const fd =await fs.promises.open(`tmp/${recursiveName}.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    await fs.promises.writeFile(`tmp/${recursiveName}.pil`, pilStr, "utf8");

    // Build stark info
    const pilRecursive1 = await compile(F, `tmp/${recursiveName}.pil`);

    const starkInfoRecursive1 = pilInfo(F, pilRecursive1, true, true, false, starkStruct);
    starkInfoRecursive1.finalSubproofId = 1;

    // Build const tree
    const {constTree, MH, verKey} = await buildConstTree(starkStruct, pilRecursive1, constPols);

    await fs.promises.writeFile(`tmp/${recursiveName}.verkey.json`, JSONbig.stringify(verKey, null, 1), "utf8");

    await MH.writeToFile(constTree, `tmp/${recursiveName}.consttree`);

    return { constRoot: verKey, starkInfo: starkInfoRecursive1}

}

async function callGenerateRecursiveSetup() {
    const constRootFibonacci = JSON.parse(await fs.promises.readFile("tmp/fibonacci.verkey.json", "utf8"));
    const starkInfoFibonacci = JSON.parse(await fs.promises.readFile("tmp/fibonacci.starkinfo.json", "utf8"));

    const starkStructRecursive1 = {
        "nBits": 11,
        "nBitsExt": 15,
        "nQueries": 32,
        "verificationHashType": "GL",
        "steps": [
            {"nBits": 15},
            {"nBits": 12},
            {"nBits": 9},
            {"nBits": 6}
        ]
    }

    const starkStructRecursive2 = {
        "nBits": 17,
        "nBitsExt": 21,
        "nQueries": 32,
        "verificationHashType": "GL",
        "steps": [
            {"nBits": 21},
            {"nBits": 17},
            {"nBits": 13},
            {"nBits": 9},
            {"nBits": 5}
        ]
    }

    const starkStructRecursiveF = {
        "nBits": 17,
        "nBitsExt": 21,
        "nQueries": 32,
        "verificationHashType": "GL",
        "steps": [
            {"nBits": 21},
            {"nBits": 17},
            {"nBits": 13},
            {"nBits": 9},
            {"nBits": 5}
        ]
    }

    const {starkInfo: starkInfoRecursive1, constRoot: constRootRecursive1} = await generateRecursiveSetup("recursive1", 1, "fibonacci", constRootFibonacci, starkInfoFibonacci, starkStructRecursive1, 18)

    const {starkInfo: starkInfoRecursive2, constRoot: constRootRecursive2} = await generateRecursiveSetup("recursive2", 1, "fibonacci", constRootRecursive1, starkInfoRecursive1, starkStructRecursive2, 18)

    const {starkInfo: starkInfoRecursiveF, constRoot: constRootRecursiveF} = await generateRecursiveSetup("recursive2", 1, "fibonacci", constRootRecursive2, starkInfoRecursive2, starkStructRecursiveF, 18)


}


callGenerateRecursiveSetup();