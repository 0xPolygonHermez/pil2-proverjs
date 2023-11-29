const fs = require("fs");
const { proof2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const path = require("path");

const log = require("../../logger.js");
const { generateProof } = require("../recursion/generateProof.js");
const { joinzkinFinal } = require("../recursion/joinzkinFinal.js");
const { nullpublics2zkin, publics2zkin } = require("../recursion/publics2zkin.js");

module.exports = async function verifyCircomCmd(setup, proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    
    const proofsBySubproofId = [];

    const publics = proofs[0].publics;

    for(let p = 0; p < proofs.length; ++p) {
        const proof = proofs[p];
        
        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        try {
            const starkInfo = setup.setup[proof.subproofId][proof.airId].starkInfo;
            const hasCompressor = setup.setup[proof.subproofId][proof.airId].hasCompressor;

            let inputs = proof2zkin(proof.proof, starkInfo);
            inputs.challenges = challenges.flat();
            inputs.challengesFRISteps = challengesFRISteps;
            inputs.publics = proof.publics;

            if(hasCompressor) {
                const {zkin: zkinCompressor, publics: publicsCompressor } = await generateProof("compressor", inputs, proof.subproofId, proof.airId);

                await fs.promises.writeFile(`tmp/proof${p}_subproof${proof.subproofId}_air${proof.airId}_compressor.proof.zkin.json`, JSONbig.stringify(zkinCompressor, 0, 1), "utf8");
                await fs.promises.writeFile(`tmp/proof${p}_subproof${proof.subproofId}_air${proof.airId}_compressor.publics.json`, JSONbig.stringify(publicsCompressor, 0, 1), "utf8");

                inputs = zkinCompressor;
            } 
            
            const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${proof.subproofId}.verkey.json`, "utf8"));
            inputs.rootCRecursive2 = verkeyRecursive2.constRoot;
  
            const {zkin: zkinRecursive1, publics: publicsRecursive1} = await generateProof("recursive1", inputs, proof.subproofId, proof.airId);

            await fs.promises.writeFile(`tmp/proof${p}_subproof${proof.subproofId}_air${proof.airId}_recursive1.proof.zkin.json`, JSONbig.stringify(zkinRecursive1, 0, 1), "utf8");
            await fs.promises.writeFile(`tmp/proof${p}_subproof${proof.subproofId}_air${proof.airId}_recursive1.publics.json`, JSONbig.stringify(publicsRecursive1, 0, 1), "utf8");

            if(!proofsBySubproofId[proof.subproofId]) proofsBySubproofId[proof.subproofId] = {
                starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${proof.subproofId}.starkinfo.json`, "utf8")),  
                rootCRecursive2: verkeyRecursive2.constRoot,
                zkin: [],
                publics: [],
            };

            proofsBySubproofId[proof.subproofId].zkin[proof.airId] = zkinRecursive1;
            proofsBySubproofId[proof.subproofId].publics[proof.airId] = publicsRecursive1;
        } catch (error) {
            log.error(`[CircomVrfr]`, `Error while verifying proof (subproofId ${proof.subproofId} airId ${proof.airId}):`);
            log.error(`[CircomVrfr]`, `${error}`);
            throw error;
        }
    }

    const verkeyRecursive2_subproof0 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof0.verkey.json`, "utf8"));

    proofsBySubproofId[0] = {
        starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof0.starkinfo.json`, "utf8")),  
        rootCRecursive2: verkeyRecursive2_subproof0.constRoot,
        zkin: [JSONbig.parse(await fs.promises.readFile(`tmp/proof1_subproof0_air0_recursive1.proof.zkin.json`, "utf8"))],
        publics: [JSONbig.parse(await fs.promises.readFile(`tmp/proof1_subproof0_air0_recursive1.publics.json`, "utf8"))],
    };

    const verkeyRecursive2_subproof1 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof1.verkey.json`, "utf8"));

    proofsBySubproofId[1] = {
        starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof1.starkinfo.json`, "utf8")),  
        rootCRecursive2: verkeyRecursive2_subproof1.constRoot,
        zkin: [JSONbig.parse(await fs.promises.readFile(`tmp/proof0_subproof1_air1_recursive1.proof.zkin.json`, "utf8"))],
        publics: [JSONbig.parse(await fs.promises.readFile(`tmp/proof0_subproof1_air1_recursive1.publics.json`, "utf8"))],
    };

    const globalInfo = JSON.parse(await fs.promises.readFile(`tmp/globalInfo.json`, "utf8"));

    for(let i = 0; i < setup.setup.length; ++i) {
        let nullProof = JSONbig.parse(await fs.promises.readFile(`tmp/subproof${i}_null.proof.zkin.json`, "utf8"));
        const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${i}.verkey.json`, "utf8"));
        
        nullProof = nullpublics2zkin(i, nullProof, globalInfo);

        if(!proofsBySubproofId[i]) {
            proofsBySubproofId[i] = {
                zkinFinal: nullProof,
                rootCRecursive2: verkeyRecursive2,
                starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${i}.starkinfo.json`, "utf8")),  
            }
        } else if(proofsBySubproofId[i].zkin.length === 1) {
            proofsBySubproofId[i].zkinFinal = publics2zkin(i, proofsBySubproofId[i].zkin[0], globalInfo, proofsBySubproofId[i].publics[0], true);
        } else {
            proofsBySubproofId[i].nullProof = nullProof;

            // TODO: JOIN RECURSIVES PROOFS UNTIL GET ONE
        } 
    }
    
    const zkinFinal = joinzkinFinal(proofsBySubproofId, globalInfo, publics, challenges, challengesFRISteps);

    await fs.promises.writeFile(`tmp/final.proof.zkin.json`, JSONbig.stringify(zkinFinal, 0, 1), "utf8");

    const {proof: finalProof, publics: finalPublics } = await generateProof("final", zkinFinal);

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}