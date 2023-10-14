const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor1", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        await this.addLibPendingTask("div_lib", "div_batch", { data: 2 }, true);
        await this.addLibPendingTask("div_lib", "div_batch", { data: 2 }, true);
    }
};
