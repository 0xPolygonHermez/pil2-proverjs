const CheckerComponent = require("../../checker.js");
const log = require("../../../logger.js");
const starkVerify = require("pil2-stark-js/src/stark/stark_verify.js");

class CheckerA extends CheckerComponent {
    constructor() {
        super("FRI Checker");
    }

    async checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps, options) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Checking...");

        const isValid = await starkVerify(proof.proof, proof.publics, constRoot, { challenges, challengesFRISteps }, starkInfo, options);

        if (isValid === false) {
            log.error(`[${this.name}]`, `STARK proof is invalid`);
        } else {
            log.info(`[${this.name}]`, `STARK proof is valid`);
        }
        
        return isValid;
    }
}

module.exports = CheckerA;
