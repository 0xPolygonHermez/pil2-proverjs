const CheckerComponent = require("../../checker.js");
const log = require("../../../logger.js");
const starkVerify = require("pil2-stark-js/src/stark/stark_verify.js");

class CheckerA extends CheckerComponent {
    constructor(proofmanagerAPI) {
        super("FRI Checker", proofmanagerAPI);
    }

    async checkProof(proof, airId, airInstanceId, proofCtx, subproofCtx) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Checking...");
        
        const airInstance = subproofCtx.airsCtx[airId].instances[airInstanceId];
        const isValid = await starkVerify(
            proof.proof,
            proof.publics,
            airInstance.airCtx.setup.constRoot,
            [],
            airInstance.airCtx.setup.starkInfo,
            { logger: log }
        );

        if (isValid === false) {
            log.error(
                `[${this.name}]`,
                `STARK proof for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId} is invalid`
            );
        }

        return isValid;
    }
}

module.exports = CheckerA;
