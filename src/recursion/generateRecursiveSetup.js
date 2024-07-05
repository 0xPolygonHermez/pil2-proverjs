
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const F3g = require('pil2-stark-js/src/helpers/f3g');
const { compile } = require('pilcom');
const pilInfo = require('pil2-stark-js/src/pil_info/pil_info.js');
const {buildConstTree} = require('pil2-stark-js/src/stark/stark_buildConstTree.js');
const pil2circom = require('stark-recurser/src/pil2circom/pil2circom.js');
const {compressorSetup} = require('stark-recurser/src/circom2pil/compressor_setup');
const {genCircom} = require('stark-recurser/src/gencircom.js');

async function genRecursiveSetup(template, subproofId, airId, globalInfo, constRoot, verificationKeys = [], starkInfo, verifierInfo, starkStruct, compressorCols, hasCompressor) {

    const F = new F3g();

    const recursiveName = ["recursive2"].includes(template) ? `${template}_subproof${subproofId}` : `${template}_subproof${subproofId}_air${airId}`;

    let inputChallenges = false;
    let verkeyInput = false;
    let enableInput = false;
    let verifierFilename;
    let templateFilename;
    let constRootCircuit = constRoot || [];
    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
        inputChallenges = true; 
        verifierFilename = `basic_stark_subproof${subproofId}_air${airId}.verifier.circom`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/compressor.circom.ejs`;
    } else if(template === "recursive1") {
        verifierFilename = `compressor_subproof${subproofId}_air${airId}.verifier.circom`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/recursive1.circom.ejs`;
    } else if (template === "recursive2") {
        verifierFilename = `recursive1_subproof${subproofId}.verifier.circom`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/recursive2.circom.ejs`;
        enableInput = globalInfo.aggTypes.length > 1 ? true : false;
        verkeyInput = true;
    }

    const options = { skipMain: true, verkeyInput, enableInput, inputChallenges, subproofId, hasCompressor }
    
    //Generate circom
    const verifierCircomTemplate = await pil2circom(constRootCircuit, starkInfo, verifierInfo, options);
    await fs.promises.writeFile(`tmp/${verifierFilename}`, verifierCircomTemplate, "utf8");

    const recursiveVerifier = await genCircom(templateFilename, [starkInfo], globalInfo, [verifierFilename], verificationKeys, [], [], options);
    const recursiveFilename = `tmp/${recursiveName}.circom`;
    await fs.promises.writeFile(recursiveFilename, recursiveVerifier, "utf8");

    // Compile circom
    const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --verbose -l node_modules/stark-recurser/src/vadcop/helpers/circuits -l node_modules/stark-recurser/src/pil2circom/circuits.gl tmp/${recursiveName}.circom -o tmp`;
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

    const {pilInfo: starkInfoRecursive, verifierInfo: verifierInfoRecursive, expressionsInfo: expressionsInfoRecursive } = pilInfo(F, pilRecursive, true, false, starkStruct, {subproofId, airId});
    starkInfoRecursive.finalSubproofId = subproofId;

    // Build const tree
    const {constTree, MH, verKey} = await buildConstTree(starkInfoRecursive, constPols);

    await fs.promises.writeFile(`tmp/${recursiveName}.verkey.json`, JSONbig.stringify(verKey, null, 1), "utf8");

    await fs.promises.writeFile(`tmp/${recursiveName}.starkinfo.json`, JSON.stringify(starkInfoRecursive, null, 1), "utf8");

    await fs.promises.writeFile(`tmp/${recursiveName}.verifierinfo.json`, JSON.stringify(verifierInfoRecursive, null, 1), "utf8");

    await fs.promises.writeFile(`tmp/${recursiveName}.expressionsinfo.json`, JSON.stringify(expressionsInfoRecursive, null, 1), "utf8");

    await MH.writeToFile(constTree, `tmp/${recursiveName}.consttree`);

    if(template === "recursive2") {
        const vks = {
            rootCRecursives1: verificationKeys,
            rootCRecursive2: verKey.constRoot,
        }
        await fs.promises.writeFile(`tmp/${recursiveName}_vks.json`, JSONbig.stringify(vks, 0, 1), "utf8");
    }

    return { constRoot: verKey, starkInfo: starkInfoRecursive, verifierInfo: verifierInfoRecursive, pil: pilStr }

}

module.exports.genRecursiveSetup = genRecursiveSetup;
