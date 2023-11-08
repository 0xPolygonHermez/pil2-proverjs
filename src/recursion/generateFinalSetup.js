
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
const {genFinal} = require('pil2-stark-js/recursive/genfinal.js');

module.exports.genFinalSetup = async function genFinalSetup(starkStructFinal, nSubproofs, compressorCols) {
    const F = new F3g();

    const starkInfosRecursivesF = [];
    const constRootsRecursiveF = [];
    for(let i = 0; i < nSubproofs; i++) {
        const name = `recursivef_subproof${i}`;
        const constRoot = JSON.parse(await fs.promises.readFile(`tmp/${name}.verkey.json`, "utf8"));
        const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/${name}.starkinfo.json`, "utf8"));

        starkInfosRecursivesF.push(starkInfo);
        constRootsRecursiveF.push(constRoot);
    }
    
    const finalName = "final";
    
    if(starkInfosRecursivesF.length !== constRootsRecursiveF.length) throw new Error("Length mismatch");
    
    //Generate RecursiveF verifiers circom
    for(let i = 0; i < starkInfosRecursivesF.length; ++i) {
        const verifierCircomTemplate = await pil2circom(constRootsRecursiveF[i].constRoot, starkInfosRecursivesF[i], { skipMain: true, subproofId: i });
        await fs.promises.writeFile(`tmp/recursivef_subproof${i}.verifier.circom`, verifierCircomTemplate, "utf8");
    }    

    // Generate final circom
    const globalInfo = JSON.parse(await fs.promises.readFile("tmp/globalInfo.json", "utf8"));
    const finalVerifier = await genFinal(globalInfo, starkInfosRecursivesF);
    const finalFilename = `tmp/final.circom`;
    await fs.promises.writeFile(finalFilename, finalVerifier, "utf8");


    // Compile circom
    console.log("Compiling " + finalFilename + "...");
    const compileFinalCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --verbose -l node_modules/pil2-stark-js/circuits.gl tmp/${finalName}.circom -o tmp`;
    const execCompile = await exec(compileFinalCommand);
    console.log(execCompile.stdout);

    // Generate setup
    const finalR1csFile = `tmp/${finalName}.r1cs`;
    const {exec: execBuff, pilStr, constPols} = await compressorSetup(F, finalR1csFile, compressorCols);

    const fd =await fs.promises.open(`tmp/${finalName}.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    await fs.promises.writeFile(`tmp/${finalName}.pil`, pilStr, "utf8");

    // Build stark info
    const pilFinal = await compile(F, `tmp/${finalName}.pil`);

    const starkInfoFinal = pilInfo(F, pilFinal, true, true, false, starkStructFinal);

    // Build const tree
    const {constTree, MH, verKey} = await buildConstTree(starkStructFinal, pilFinal, constPols);

    await fs.promises.writeFile(`tmp/${finalName}.verkey.json`, JSONbig.stringify(verKey, null, 1), "utf8");

    await fs.promises.writeFile(`tmp/${finalName}.starkinfo.json`, JSON.stringify(starkInfoFinal, null, 1), "utf8");

    await MH.writeToFile(constTree, `tmp/${finalName}.consttree`);
    
    return {starkInfoFinal, constRootFinal: verKey};
}