
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');
const { starkGen, starkVerify } = require('pil2-stark-js');
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { proof2zkin } = require('pil2-stark-js/src/proof2zkin');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const log = require("../../logger.js");
const { generateFixedCols } = require('pil2-stark-js/src/witness/witnessCalculator.js');

const { publics2zkin } = require('stark-recurser/src/pil2circom/publics2zkin.js');
const { compressorExec, readExecFile } = require('stark-recurser/src/circom2pil/compressor_exec.js');

module.exports.generateProof = async function generateProof(template, inputs, globalInfo, airgroupId, airId) {
    const F = new F3g();

    let airgroupName = globalInfo.airgroups[airgroupId];
    let airName = globalInfo.airs[airgroupId][airId].airName;

    let recursiveName;
    let filesDir;
    if(template === "final") {
        recursiveName = "final";
        filesDir = `tmp/provingKey/${globalInfo.name}/final`;
    } else if(template === "recursive2") {
        recursiveName = `${airgroupName}_recursive2`;
        filesDir = `tmp/provingKey/${globalInfo.name}/${airgroupName}/recursive2`;
    } else if(["recursive1", "compressor"].includes(template)) {
        recursiveName = `${airName}_${template}`;
        filesDir = `tmp/provingKey/${globalInfo.name}/${airgroupName}/airs/${airName}/${template}`;
    } else {
        throw new Error("Unknown template");
    }

    const starkInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.starkinfo.json`, "utf8"));

    const expressionsInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.expressionsinfo.json`, "utf8"));

    const verifierInfo = JSON.parse(await fs.promises.readFile(`${filesDir}/${template}.verifierinfo.json`, "utf8"));

    const constRoot = JSONbig.parse(await fs.promises.readFile(`${filesDir}/${template}.verkey.json`, "utf8"));

    const pil = await compile(F, `tmp/pil/${recursiveName}.pil`);

    const exec = await readExecFile(`${filesDir}/${template}.exec`, pil.references["Compressor.a"].len);
    
    const fd =await fs.promises.open(`tmp/build/${recursiveName}_js/${recursiveName}.wasm`, "r");
    const st =await fd.stat();
    const wasm = new Uint8Array(st.size);
    await fd.read(wasm, 0, st.size);
    await fd.close();

    const {cmPols, publics} = await compressorExec(F, pil, wasm, inputs, exec, false);

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
    } else {
        log.info("Stark Verification SUCCEEDED!");
    }

    let zkin = proof2zkin(resP.proof, starkInfo);

    if(template === "compressor") {
        const globalInfo =  JSON.parse(await fs.promises.readFile(`tmp/provingKey/pilout.globalInfo.json`, "utf8"));
        zkin = publics2zkin(airgroupId, zkin, globalInfo, resP.publics);
    }    

    return {proof: resP.proof, publics: resP.publics, zkin };
}