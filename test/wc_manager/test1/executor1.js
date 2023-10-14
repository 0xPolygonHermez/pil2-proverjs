const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor1", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        await this.addLibPendingTask("Executor2", "newInstance", { data: 2 }, false);
    }
}