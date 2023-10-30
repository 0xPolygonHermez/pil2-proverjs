const VerifierComponent = require("../../verifier.js");
const log = require("../../../logger.js");
const starkVerify = require("pil2-stark-js/src/stark/stark_verify.js");

class StarkFriVerifier extends VerifierComponent {
    constructor() {
        super("FRIVerfier");
    }

    async checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps, options) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> STARK verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        const isValid = await starkVerify(proof.proof, proof.publics, constRoot, { challenges, challengesFRISteps }, starkInfo, options);

        if (isValid === false) {
            log.error(`[${this.name}]`, `INVALID STARK proof`);
        } else {
            log.info(`[${this.name}]`, `STARK proof successfully verified`);
        }

        const logX = isValid ? log.info : log.error;
        logX(`[${this.name}]`, `<-- STARK verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        return isValid;
    }
}

module.exports = StarkFriVerifier;
