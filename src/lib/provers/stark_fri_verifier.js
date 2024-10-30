const VerifierComponent = require("../../verifier.js");
const log = require("../../../logger.js");
const starkVerify = require("pil2-stark-js/src/stark/stark_verify.js");

class StarkFriVerifier extends VerifierComponent {
    constructor() {
        super("FRIVerfier");
    }

    async checkProof(proof, constRoot, starkInfo, verifierInfo, airoutInfo, challenges, publics, proofValues, options) {
        this.checkInitialized();

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
}

module.exports = StarkFriVerifier;
