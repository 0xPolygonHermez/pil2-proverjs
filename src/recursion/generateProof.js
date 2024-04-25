
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile, newConstantPolsArray } = require('pilcom');
const { starkGen, starkVerify } = require('pil2-stark-js');
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { proof2zkin } = require('pil2-stark-js/src/proof2zkin');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { compressorExec, readExecFile } = require('pil2-stark-js/src/compressor/compressor_exec');
const { publics2zkin } = require('./publics2zkin');
const log = require("../../logger.js");

module.exports.generateProof = async function generateProof(template, inputs, subproofId, airId) {
    const F = new F3g();

    let recursiveName;
    if(template === "final") {
        recursiveName = "final";
    } else if(template === "recursive2") {
        recursiveName = `recursive2_subproof${subproofId}`;
    } else {
        recursiveName = `${template}_subproof${subproofId}_air${airId}`;
    }

    const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/${recursiveName}.starkinfo.json`, "utf8"));

    const expressionsInfo = JSON.parse(await fs.promises.readFile(`tmp/${recursiveName}.expressionsinfo.json`, "utf8"));

    const verifierInfo = JSON.parse(await fs.promises.readFile(`tmp/${recursiveName}.verifierinfo.json`, "utf8"));

    const verkey = JSONbig.parse(await fs.promises.readFile(`tmp/${recursiveName}.verkey.json`, "utf8"));
    const constRoot = verkey.constRoot;

    const pil = await compile(F, `tmp/${recursiveName}.pil`);

    const exec = await readExecFile(`tmp/${recursiveName}.exec`, pil.references["Compressor.a"].len);
    
    const fd =await fs.promises.open(`tmp/${recursiveName}_js/${recursiveName}.wasm`, "r");
    const st =await fd.stat();
    const wasm = new Uint8Array(st.size);
    await fd.read(wasm, 0, st.size);
    await fd.close();

    const { cmPols, publics } = await compressorExec(F, pil, wasm, inputs, exec, starkInfo.nPublics);

    const constPols = newConstantPolsArray(pil);
    await constPols.loadFromFile(`tmp/${recursiveName}.const`);

    const MH = await buildMerkleHashGL();

    const constTree = await MH.readFromFile(`tmp/${recursiveName}.consttree`);
    
    log.info(`[GENERATEPROOF]`, `--> Generating proof for ${recursiveName}`);
    const resP = await starkGen(cmPols, constPols, constTree, starkInfo, expressionsInfo, publics);
    log.info(`[GENERATEPROOF]`, `--> Generating proof completed`);

    log.info(`[GENERATEPROOF]`, `--> Verifying proof for ${recursiveName}`);
    const resV = await starkVerify(resP.proof, resP.publics, constRoot, {challenges: resP.challenges, challengesFRISteps: resP.challengesFRISteps}, starkInfo, verifierInfo);

    if (!resV) {
        throw new Error("Verification FAIL!");
    }

    let zkin = proof2zkin(resP.proof, starkInfo);

    if(template === "compressor") {
        const globalInfo =  JSON.parse(await fs.promises.readFile(`tmp/globalInfo.json`, "utf8"));
        zkin = publics2zkin(subproofId, zkin, globalInfo, resP.publics);
    }    

    return {proof: resP.proof, publics: resP.publics, zkin };
}