const fs = require("fs");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const log = require("../../logger.js");
const { generateProof } = require("../recursion/generateProof.js");
const { joinzkinFinal } = require("stark-recurser/src/pil2circom/joinzkinFinal.js");
const { proof2zkin } = require("stark-recurser/src/pil2circom/proof2zkin.js");
const { nullpublics2zkin, publics2zkin } = require("stark-recurser/src/pil2circom/publics2zkin.js");

module.exports = async function verifyCircomCmd(setup, proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const globalInfo = JSON.parse(await fs.promises.readFile(`tmp/config/airout.globalInfo.json`, "utf8"));

    await fs.promises.mkdir(`tmp/proofs/`, { recursive: true });
    
    const proofsBySubproofId = [];

    const publics = proofs[0].publics;

    for(let p = 0; p < proofs.length; ++p) {
        const proof = proofs[p];
        
        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        try {
            const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[proof.subproofId]}/airs/${globalInfo.subproofs[proof.subproofId]}_${proof.airId}/air/${globalInfo.subproofs[proof.subproofId]}_${proof.airId}.starkinfo.json`, "utf8"));
            const hasCompressor = globalInfo.airs[proof.subproofId][proof.airId].hasCompressor;

            const subproofId = proof.subproofId;
            const airId = proof.airId;

            let inputs = proof2zkin(proof.proof, starkInfo, "sv");
            inputs.challenges = challenges.flat();
            inputs.challengesFRISteps = challengesFRISteps;
            inputs.publics = proof.publics;

            if(hasCompressor) {
                const {zkin: zkinCompressor, publics: publicsCompressor } = await generateProof("compressor", inputs, globalInfo, subproofId, airId);

                await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${proof.subproofId}_air${proof.airId}_compressor.proof.zkin.json`, JSONbig.stringify(zkinCompressor, (k, v) => {
                    if (typeof(v) === "bigint") {
                        return v.toString();
                    } else {
                        return v;
                    }
                }, 1), "utf8");
                await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${proof.subproofId}_air${proof.airId}_compressor.publics.json`, JSONbig.stringify(publicsCompressor, null, 1), "utf8");

                inputs = zkinCompressor;
            } 
            
            const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[proof.subproofId]}/recursive2/recursive2.verkey.json`, "utf8"));
            inputs.rootCAgg = verkeyRecursive2;
            
            const {zkin: zkinRecursive1, publics: publicsRecursive1} = await generateProof("recursive1", inputs, globalInfo, subproofId, airId);

            await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${proof.subproofId}_air${proof.airId}_recursive1.proof.zkin.json`, JSONbig.stringify(zkinRecursive1, (k, v) => {
                if (typeof(v) === "bigint") {
                    return v.toString();
                } else {
                    return v;
                }
            }, 1), "utf8");
            await fs.promises.writeFile(`tmp/proofs/proof${p}_subproof${proof.subproofId}_air${proof.airId}_recursive1.publics.json`, JSONbig.stringify(publicsRecursive1, null, 1), "utf8");

            if(!proofsBySubproofId[proof.subproofId]) proofsBySubproofId[proof.subproofId] = {
                starkInfoRecursive2: JSON.parse(await fs.promises.readFile(`tmp/recursive2_subproof${proof.subproofId}.starkinfo.json`, "utf8")),  
                rootCRecursive2: verkeyRecursive2,
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
        zkin: [JSONbig.parse(await fs.promises.readFile(`tmp/proofs/proof1_subproof0_air0_recursive1.proof.zkin.json`, "utf8"))],
        publics: [JSONbig.parse(await fs.promises.readFile(`tmp/proofs/proof1_subproof0_air0_recursive1.publics.json`, "utf8"))],
    };

    const verkeyRecursive2_subproof1 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof1.verkey.json`, "utf8"));

    proofsBySubproofId[1] = {
        starkInfoRecursive2: JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof1.starkinfo.json`, "utf8")),  
        rootCRecursive2: verkeyRecursive2_subproof1.constRoot,
        zkin: [JSONbig.parse(await fs.promises.readFile(`tmp/proofs/proof0_subproof1_air1_recursive1.proof.zkin.json`, "utf8"))],
        publics: [JSONbig.parse(await fs.promises.readFile(`tmp/proofs/proof0_subproof1_air1_recursive1.publics.json`, "utf8"))],
    };

    for(let i = 0; i < setup.setup.length; ++i) {
        let nullProof = JSONbig.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2_${globalInfo.subproofs[i]}_null.proof.zkin.json`, "utf8"));
        const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2.verkey.json`, "utf8"));
        
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

    await fs.promises.writeFile(`tmp/final.proof.zkin.json`, JSONbig.stringify(zkinFinal, (k, v) => {
        if (typeof(v) === "bigint") {
            return v.toString();
        } else {
            return v;
        }
    }, 1), "utf8");

    const {proof: finalProof, publics: finalPublics } = await generateProof("final", zkinFinal);

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}