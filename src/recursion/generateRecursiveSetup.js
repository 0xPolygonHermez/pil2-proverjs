
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
const {genRecursive} = require('./genrecursive.js');

async function genRecursiveSetup(template, subproofId, airId, constRoot, verificationKeys, starkInfo, starkStruct, compressorCols, hasCompressor) {

    const F = new F3g();

    const recursiveName = ["recursive2"].includes(template) ? `${template}_subproof${subproofId}` : `${template}_subproof${subproofId}_air${airId}`;

    let hashCommits = false;
    let vadcop = false;
    let verkeyInput = false;
    let enableInput = false;
    let verifierFilename;
    let constRootCircuit = constRoot || [];
    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
        hashCommits = true;
        vadcop = true; 
        verifierFilename = `tmp/basic_stark_subproof${subproofId}_air${airId}.verifier.circom`;
    } else if(template === "recursive1") {
        verifierFilename = `tmp/compressor_subproof${subproofId}_air${airId}.verifier.circom`;
    } else if (template === "recursive2") {
        verifierFilename = `tmp/recursive1_subproof${subproofId}.verifier.circom`;
        enableInput = true;
        verkeyInput = true;
    }


    const options = { hashCommits, vadcop, skipMain: true, verkeyInput, enableInput }

    //Generate circom
    const verifierCircomTemplate = await pil2circom(constRootCircuit, starkInfo, options);
    await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

    // Generate recursive circom
    const globalInfo = JSON.parse(await fs.promises.readFile("tmp/globalInfo.json", "utf8"));
    const recursiveVerifier = await genRecursive(template, subproofId, airId, verificationKeys, starkInfo, globalInfo, hasCompressor);
    const recursiveFilename = `tmp/${recursiveName}.circom`;
    await fs.promises.writeFile(recursiveFilename, recursiveVerifier, "utf8");

    // Compile circom
    const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --verbose -l node_modules/pil2-stark-js/circuits.gl tmp/${recursiveName}.circom -o tmp`;
    await exec(compileRecursiveCommand);

    // Generate setup
    const recursiveR1csFile = `tmp/${recursiveName}.r1cs`;
    const {exec: execBuff, pilStr, constPols} = await compressorSetup(F, recursiveR1csFile, compressorCols);

    await constPols.saveToFile(`tmp/${recursiveName}.const`);

    const fd =await fs.promises.open(`tmp/${recursiveName}.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    await fs.promises.writeFile(`tmp/${recursiveName}.pil`, pilStr, "utf8");

    // Build stark info
    const pilRecursive = await compile(F, `tmp/${recursiveName}.pil`);

    const starkInfoRecursive = pilInfo(F, pilRecursive, true, true, false, starkStruct);
    starkInfoRecursive.finalSubproofId = subproofId;

    // Build const tree
    const {constTree, MH, verKey} = await buildConstTree(starkStruct, pilRecursive, constPols);

    await fs.promises.writeFile(`tmp/${recursiveName}.verkey.json`, JSONbig.stringify(verKey, null, 1), "utf8");

    await fs.promises.writeFile(`tmp/${recursiveName}.starkinfo.json`, JSON.stringify(starkInfoRecursive, null, 1), "utf8");

    await MH.writeToFile(constTree, `tmp/${recursiveName}.consttree`);

    if(template === "recursive2") {
        const vks = {
            rootCRecursives1: verificationKeys,
            rootCRecursive2: verKey.constRoot,
        }
        await fs.promises.writeFile(`tmp/${recursiveName}_vks.json`, JSONbig.stringify(vks, 0, 1), "utf8");
    }

    return { constRoot: verKey, starkInfo: starkInfoRecursive, pil: pilStr }

}

module.exports.genRecursiveSetup = genRecursiveSetup;
