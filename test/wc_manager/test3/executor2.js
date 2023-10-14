const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor2", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        await this.addLibPendingTask("div_lib", "div_batch", { data: 2 }, true);
    }
}