const fs = require("fs");
const { proof2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const path = require("path");

const log = require("../../logger.js");
const { generateProof } = require("../recursion/generateProof.js");
const { joinzkinFinal } = require("../recursion/joinzkinFinal.js");
const { nullpublics2zkin } = require("../recursion/publics2zkin.js");

module.exports = async function verifyCircomCmd(setup, proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

    let verifierFilename;
    
    const proofsBySubproofId = [];

    const publics = proofs[0].publics;

    for(const proof of proofs) {
        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        try {
            const starkInfo = setup.setup[proof.subproofId][proof.airId].starkInfo;
            const hasCompressor = setup.setup[proof.subproofId][proof.airId].hasCompressor;

            let inputs = proof2zkin(proof.proof, starkInfo);
            inputs.challenges = challenges.flat();
            inputs.challengesFRISteps = challengesFRISteps;
            inputs.publics = proof.publics;

            if(hasCompressor) {
                const {zkin: zkinCompressor} = await generateProof("compressor", inputs, proof.subproofId, proof.airId);
                inputs = zkinCompressor;
            } 
            
            const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${proof.subproofId}.verkey.json`, "utf8"));
            inputs.rootCRecursive2 = verkeyRecursive2.constRoot;
  
            const verkeyRecursive1 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive1_subproof${proof.subproofId}_air${proof.airId}.verkey.json`, "utf8"));

            const {zkin: zkinRecursive1, publics: publicsRecursive1} = await generateProof("recursive1", inputs, proof.subproofId, proof.airId);

            if(!proofsBySubproofId[proof.subproofId]) proofsBySubproofId[proof.subproofId] = {
                starkInfosRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${proof.subproofId}.starkinfo.json`, "utf8")),  
                rootCRecursive2: verkeyRecursive2.constRoot,
                rootCRecursives1: [],
                zkin: [],
                publics: [],
            };
            proofsBySubproofId[proof.subproofId].zkin[proof.airId] = zkinRecursive1;
            proofsBySubproofId[proof.subproofId].publics[proof.airId] = publicsRecursive1;
            proofsBySubproofId[proof.subproofId].rootCRecursives1[proof.airId] = verkeyRecursive1.constRoot;

            
            // verifierFilename = path.join(tmpPath, "basic_stark_verifier_" + setup.config.name + "_subproof" + proof.subproofId + "_airId" + proof.airId + ".circom");
            // const verifierCircomTemplate = await pil2circom(constRoot, starkInfo, { hashCommits: true, vadcop: true });
            // await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

            // const circuit = await wasm_tester(verifierFilename, { O:1, prime: "goldilocks", include: "node_modules/pil2-stark-js/circuits.gl", verbose: true });

            // let input = proof2zkin(proof.proof, starkInfo);
            // input = challenges2zkin({challenges, challengesFRISteps}, starkInfo, input);
            // input.publics = proof.publics;

            // await circuit.calculateWitness(input, true);

            // log.info(`[CircomVrfr]`, `<-- CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        } catch (error) {
            log.error(`[CircomVrfr]`, `Error while verifying proof (subproofId ${proof.subproofId} airId ${proof.airId}):`);
            log.error(`[CircomVrfr]`, `${error}`);
            throw error;
        } finally {
            await fs.promises.unlink(verifierFilename);
        }
    }

    for(let i = 0; i < setup.length; ++i) {
        const proofs = proofsBySubproofId[i];

        let nullProof = JSONbig.parse(await fs.promises.readFile(`tmp/subproof${i}_null.starkinfo.json`, "utf8"));
        const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${i}.verkey.json`, "utf8"));
        
        nullProof = nullpublics2zkin(i, nullProof, globalInfo);

        if(!proofs) {
            proofs = {
                zkinFinal: nullProof,
                rootCRecursive2: verkeyRecursive2,
                starkInfosRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${i}.starkinfo.json`, "utf8")),  
            }
        } else {
            proofs.isNull = true;
            proofs.nullProof = nullProof;
        } 
        
        if(proofs.zkin.length === 1) {
            proofs.zkinFinal = proofs.zkin[0];
        } else {
            // TODO: JOIN RECURSIVES PROOFS UNTIL GET ONE
        }
    }
    
    const globalInfo =  JSON.parse(await fs.promises.readFile(`tmp/globalInfo.json`, "utf8"));

    const zkinFinal = joinzkinFinal(proofsBySubproofId, globalInfo, publics, challenges, challengesFRISteps);
    await fs.promises.writeFile(`tmp/final.proof.zkin.json`, JSON.stringify(zkinFinal, 0, 1), "utf8");

    const {proof: finalProof, publics: finalPublics } = await generateProof("final", zkinFinal);

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}