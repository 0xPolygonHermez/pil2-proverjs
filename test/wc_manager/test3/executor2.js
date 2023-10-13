const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor2", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        return new Promise(async (resolve) => {
            log.info(`[${this.name}]`, `Starting stageId: ${stageId}, airCtx: ${airCtx}, airInstanceId: ${airInstanceId}`);

            const A = await this.wcManager.readData(this, "A");

            log.info(`[${this.name}]`, "Finishing");

            this.wcManager.deferredMutex.release();
            resolve();
        });
    }
}