const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor3 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("div_lib", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        return new Promise(async (resolve) => {
            log.info(`[${this.name}]`, `Starting stageId: ${stageId}, airCtx: ${airCtx}, airInstanceId: ${airInstanceId}`);

            resolve();
            log.info(`[${this.name}]`, "Finishing");
        });
    }
}