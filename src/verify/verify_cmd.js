const log = require("../../logger.js");
const F3g = require("../setup/pil2-stark/utils/f3g.js");
const { executeCode, starkVerify } = require("./stark_verify.js");

module.exports = async function verifyCmd(setup, proofs, challenges, publics, proofValues, options) {
    log.info("[VerifyCmd ]", "==> PROOF VERIFICATION")

    let isValid = true;

    const globalConstraints = setup.airoutInfo.globalConstraints.constraints;
    if(globalConstraints !== undefined && globalConstraints.length > 0) {
        
        const F = new F3g();

        log.info("[VrfyCmd ]", "==> VERIFYING GLOBAL CONSTRAINTS")

        const airgroupValuesProof = [];
        
        for(let i = 0; i < setup.airoutInfo.air_groups.length; ++i) {
            const spValues = [];
            for(let j = 0; j < setup.airoutInfo.aggTypes[i].length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[i][j].aggType;
                const value = aggType === 0 ? [0n, 0n, 0n] : [1n, 0n, 0n];
                spValues.push(value);
            }
            airgroupValuesProof.push(spValues)
        }

        for(let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            const airgroupId = proof.airgroupId;
            const airgroupValues = proof.airgroupValues;
            for(let j = 0; j < airgroupValues.length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[airgroupId][j].aggType;
                    airgroupValuesProof[airgroupId][j] = aggType === 0
                    ? F.add(airgroupValuesProof[airgroupId][j], airgroupValues[j])
                    : F.mul(airgroupValuesProof[airgroupId][j], airgroupValues[j]);
            }
        }

        for(let i = 0; i < globalConstraints.length; i++) {
            log.info("[VrfyCmd ]", "··· Verifying Global Constraint", i + 1, "/", globalConstraints.length);
            log.info(globalConstraints[i].line);
            const res = executeCode(F, {airgroupValues: airgroupValuesProof, publics, proofValues, challenges: challenges.challenges}, globalConstraints[i].code, true);
            isValid = isValid && F.isZero(res);

            if(!isValid) {
                log.error("[VrfyCmd ]", "Global Constraint", i + 1, "failed.");
            }
        }

        log.info("[VrfyCmd ]", "<== VERIFYING GLOBAL CONSTRAINTS")
    }

    let index = 0;
    for(const proof of proofs) {    
        const constRoot = setup.setup[proof.airgroupId][proof.airId].constRoot;
        const starkInfo = setup.setup[proof.airgroupId][proof.airId].starkInfo;
        const verifierInfo = setup.setup[proof.airgroupId][proof.airId].verifierInfo;

        let isValidProof = await checkProof(proof, constRoot, starkInfo, verifierInfo, setup.airoutInfo, challenges, publics, proofValues, options);
        
        if(!isValidProof) log.error("[VrfyCmd ]", "Proof verification ", index, " failed.");
        
        isValid = isValid && isValidProof;

        ++index;
    }

    const logX = isValid ? log.info : log.error;
    logX("[VrfyCmd ]", "<== PROOF VERIFICATION")

    return isValid;
}

async function checkProof(proof, constRoot, starkInfo, verifierInfo, airoutInfo, challenges, publics, proofValues, options) {

    log.info(`[${this.name}]`, `--> STARK verification (airgroupId ${proof.airgroupId} airId ${proof.airId})`);

    const challengesFRIStepsProof = [];
    for(let i = 0; i < starkInfo.starkStruct.steps.length; i++) {
        let stepIndex = airoutInfo.stepsFRI.findIndex(step => step.nBits === starkInfo.starkStruct.steps[i].nBits);
        challengesFRIStepsProof.push(challenges.challengesFRISteps[stepIndex]);
    }
    challengesFRIStepsProof.push(challenges.challengesFRISteps[airoutInfo.stepsFRI.length]);
    
    const challengesProof = { challenges: challenges.challenges, challengesFRISteps: challengesFRIStepsProof };

    const isValid = await starkVerify(proof, proofValues, publics, constRoot, challengesProof, starkInfo, verifierInfo, options);

    if (isValid === false) {
        log.error(`[${this.name}]`, `INVALID STARK proof`);
    } else {
        log.info(`[${this.name}]`, `STARK proof successfully verified`);
    }

    const logX = isValid ? log.info : log.error;
    logX(`[${this.name}]`, `<-- STARK verification (airgroupId ${proof.airgroupId} airId ${proof.airId})`);

    return isValid;
}