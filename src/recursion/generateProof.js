
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { verifyPil, compile, newConstantPolsArray } = require('pilcom');
const { starkGen, starkVerify } = require('pil2-stark-js');
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { proof2zkin } = require('pil2-stark-js/src/proof2zkin');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { compressorExec } = require('pil2-stark-js/src/compressor/compressor_exec');
const { readExecFile } = require('pil2-stark-js/src/compressor/exec_helpers');
const { publics2zkin } = require('./publics2zkin');

module.exports.generateProof = async function generateProof(template, subproofId, airId, inputs) {
    const F = new F3g();

    const recursiveName = ["recursive2"].includes(template) ? `${template}_subproof${subproofId}` : `${template}_subproof${subproofId}_air${airId}`;

    const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/${recursiveName}.starkinfo.json`, "utf8"));

    const verkey = JSONbig.parse(await fs.promises.readFile(`tmp/${recursiveName}.verkey.json`, "utf8"));
    const constRoot = verkey.constRoot;

    const pil = await compile(F, `tmp/${recursiveName}.pil`);

    const exec = await readExecFile(`tmp/${recursiveName}.exec`, pil.references["Compressor.a"].len);

    const fd =await fs.promises.open(`tmp/${recursiveName}_js/${recursiveName}.wasm`, "r");
    const st =await fd.stat();
    const wasm = new Uint8Array(st.size);
    await fd.read(wasm, 0, st.size);
    await fd.close();

    const cmPols = await compressorExec(F, pil, wasm, inputs, exec);

    const constPols = newConstantPolsArray(pil);
    await constPols.loadFromFile(`tmp/${recursiveName}.const`);

    const MH = await buildMerkleHashGL();

    const constTree = await MH.readFromFile(`tmp/${recursiveName}.consttree`);

    const resP = await starkGen(cmPols, constPols, constTree, starkInfo);

    const resV = await starkVerify(resP.proof, resP.publics, constRoot, resP.challenges, starkInfo);

    if (!resV) {
        throw new Error("Verification FAIL!");
    }

    let zkin = proof2zkin(resP.proof, starkInfo);
      
    let constRootCRecursive2;
    if(template === "compressor") {
        const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${subproofId}.verkey.json`, "utf8"));
        constRootCRecursive2 = verkeyRecursive2.constRoot;
    }

    const globalInfo =  JSON.parse(await fs.promises.readFile(`tmp/globalInfo.json`, "utf8"));

    zkin = publics2zkin(subproofId, zkin, globalInfo, resP.publics, constRootCRecursive2);

    return {proof: resP.proof, publics: resP.publics, zkin };
}