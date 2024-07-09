const fs = require("fs");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const log = require("../../logger.js");
const { generateProof } = require("../recursion/generateProof.js");
const { joinzkinFinal } = require("stark-recurser/src/pil2circom/joinzkinFinal.js");
const { proof2zkin } = require("stark-recurser/src/pil2circom/proof2zkin.js");
const { nullpublics2zkin, publics2zkin } = require("stark-recurser/src/pil2circom/publics2zkin.js");

module.exports = async function verifyCircomCmd(proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const globalInfo = JSON.parse(await fs.promises.readFile(`tmp/provingKey/pilout.globalInfo.json`, "utf8"));

    await fs.promises.mkdir(`tmp/proofs/`, { recursive: true });
    
    const proofsBySubproofId = [];

    const publics = proofs[0].publics;

    for(let p = 0; p < proofs.length; ++p) {
        const proof = proofs[p];
        
        const subproofId = proof.subproofId;
        const airId = proof.airId;

        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${subproofId} airId ${airId})`);

        try {
            const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[subproofId]}/airs/${globalInfo.subproofs[subproofId]}_${airId}/air/${globalInfo.subproofs[subproofId]}_${airId}.starkinfo.json`, "utf8"));
            const hasCompressor = globalInfo.airs[subproofId][airId].hasCompressor;

            let inputs = proof2zkin(proof.proof, starkInfo, "sv");
            inputs.challenges = challenges.flat();
            inputs.challengesFRISteps = challengesFRISteps;
            inputs.publics = proof.publics;

            if(hasCompressor) {
                const {zkin: zkinCompressor, publics: publicsCompressor } = await generateProof("compressor", inputs, globalInfo, subproofId, airId);

                await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${subproofId}_air${airId}_compressor.proof.zkin.json`, JSONbig.stringify(zkinCompressor, (k, v) => {
                    if (typeof(v) === "bigint") {
                        return v.toString();
                    } else {
                        return v;
                    }
                }, 1), "utf8");
                await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${subproofId}_air${airId}_compressor.publics.json`, JSONbig.stringify(publicsCompressor, null, 1), "utf8");

                inputs = zkinCompressor;
            } 
            
            const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[subproofId]}/recursive2/recursive2.verkey.json`, "utf8"));
            inputs.rootCAgg = verkeyRecursive2;
            
            const {zkin: zkinRecursive1, publics: publicsRecursive1} = await generateProof("recursive1", inputs, globalInfo, subproofId, airId);

            await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${subproofId}_air${airId}_recursive1.proof.zkin.json`, JSONbig.stringify(zkinRecursive1, (k, v) => {
                if (typeof(v) === "bigint") {
                    return v.toString();
                } else {
                    return v;
                }
            }, 1), "utf8");
            await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${subproofId}_air${airId}_recursive1.publics.json`, JSONbig.stringify(publicsRecursive1, null, 1), "utf8");

            if(!proofsBySubproofId[subproofId]) proofsBySubproofId[subproofId] = {
                starkInfoRecursive2: JSON.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[subproofId]}/recursive2/recursive2.starkinfo.json`, "utf8")),  
                rootCRecursive2: verkeyRecursive2,
                zkin: [],
                publics: [],
            };

            proofsBySubproofId[subproofId].zkin.push(zkinRecursive1);
            proofsBySubproofId[subproofId].publics.push(publicsRecursive1);
        } catch (error) {
            log.error(`[CircomVrfr]`, `Error while verifying proof (subproofId ${subproofId} airId ${airId}):`);
            log.error(`[CircomVrfr]`, `${error}`);
            throw error;
        }
    }


    for(let i = 0; i < globalInfo.subproofs.length; ++i) {
        let nullProof = JSONbig.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2_${globalInfo.subproofs[i]}_null.proof.zkin.json`, "utf8"));
        const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2.verkey.json`, "utf8"));
        
        nullProof = nullpublics2zkin(i, nullProof, globalInfo);

        if(!proofsBySubproofId[i]) {
            proofsBySubproofId[i] = {
                zkinFinal: nullProof,
                rootCRecursive2: verkeyRecursive2,
                starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/provingKey/${globalInfo.name}/${globalInfo.subproofs[1]}/recursive2/recursive2.starkinfo.json`, "utf8")),  
            }
        } else if(proofsBySubproofId[i].zkin.length === 1) {
            proofsBySubproofId[i].zkinFinal = publics2zkin(i, proofsBySubproofId[i].zkin[0], globalInfo, proofsBySubproofId[i].publics[0], true);
        } else {
            proofsBySubproofId[i].nullProof = nullProof;

            // TODO: JOIN RECURSIVES PROOFS UNTIL GET ONE
        } 
    }
    
    const zkinFinal = joinzkinFinal(proofsBySubproofId, globalInfo, publics, challenges, challengesFRISteps);

    await fs.promises.writeFile(`tmp/proofs/final.proof.zkin.json`, JSONbig.stringify(zkinFinal, (k, v) => {
        if (typeof(v) === "bigint") {
            return v.toString();
        } else {
            return v;
        }
    }, 1), "utf8");

    const {proof: finalProof, publics: finalPublics } = await generateProof("final", zkinFinal, globalInfo);

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}