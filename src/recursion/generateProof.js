
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');
const { starkGen, starkVerify } = require('pil2-stark-js');
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { proof2zkin } = require('pil2-stark-js/src/proof2zkin');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { compressorExec, readExecFile } = require('pil2-stark-js/src/compressor/compressor_exec');
const { publics2zkin } = require('stark-recurser/src/pil2circom/publics2zkin.js');
const log = require("../../logger.js");
const { generateFixedCols } = require('pil2-stark-js/src/witness/witnessCalculator.js');

module.exports.generateProof = async function generateProof(template, inputs, globalInfo, subproofId, airId) {
    const F = new F3g();

    let subproofName = globalInfo.subproofs[subproofId];

    let recursiveName;
    let filesDir;
    if(template === "final") {
        recursiveName = "final";
        filesDir = `tmp/config/${globalInfo.name}/final`;
    } else if(template === "recursive2") {
        recursiveName = `recursive2_${subproofName}`;
        filesDir = `tmp/config/${globalInfo.name}/${subproofName}/recursive2`;
    } else if(["recursive1", "compressor"].includes(template)) {
        recursiveName = `${template}_${subproofName}_${airId}`;
        filesDir = `tmp/config/${globalInfo.name}/${subproofName}/airs/${subproofName}_${airId}/${template}`;
    } else {
        throw new Error("Unknown template");
    }

    const starkInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.starkinfo.json`, "utf8"));

    const expressionsInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.expressionsinfo.json`, "utf8"));

    const verifierInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.verifierinfo.json`, "utf8"));

    const constRoot = JSONbig.parse(await fs.promises.readFile(`${filesDir}/${template}.verkey.json`, "utf8"));

    const pil = await compile(F, `tmp/pil/${template}_${subproofName}_${airId}.pil`);

    const exec = await readExecFile(`${filesDir}/${template}.exec`, pil.references["Compressor.a"].len);
    
    const fd =await fs.promises.open(`tmp/build/${recursiveName}_js/${recursiveName}.wasm`, "r");
    const st =await fd.stat();
    const wasm = new Uint8Array(st.size);
    await fd.read(wasm, 0, st.size);
    await fd.close();

    const {cmPols, publics} = await compressorExec(F, pil, wasm, inputs, exec, starkInfo.nPublics);

    const constPols = generateFixedCols(pil.references, Object.values(pil.references)[0].polDeg, false);
    await constPols.loadFromFile(`${filesDir}/${template}.const`);

    const MH = await buildMerkleHashGL();

    const constTree = await MH.readFromFile(`${filesDir}/${template}.consttree`);
    
    log.info(`[GENERATEPROOF]`, `--> Generating proof for ${recursiveName}`);
    const resP = await starkGen(cmPols, constPols, constTree, starkInfo, expressionsInfo, publics, { parallelExec: true, useThreads: true, logger: log });
    log.info(`[GENERATEPROOF]`, `--> Generating proof completed`);

    log.info(`[GENERATEPROOF]`, `--> Verifying proof for ${recursiveName}`);
    const resV = await starkVerify(resP.proof, resP.publics, constRoot, {challenges: resP.challenges, challengesFRISteps: resP.challengesFRISteps}, starkInfo, verifierInfo);

    if (!resV) {
        throw new Error("Verification FAIL!");
    }

    let zkin = proof2zkin(resP.proof, starkInfo);

    if(template === "compressor") {
        const globalInfo =  JSON.parse(await fs.promises.readFile(`tmp/config/airout.globalInfo.json`, "utf8"));
        zkin = publics2zkin(subproofId, zkin, globalInfo, resP.publics);
    }    

    return {proof: resP.proof, publics: resP.publics, zkin };
}