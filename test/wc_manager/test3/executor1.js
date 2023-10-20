const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofmanagerAPI) {
        super("Executor1", wcManager, proofmanagerAPI);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        await this.addPendingTask("divLib", "div_batch", { data: 2 }, true);
        await this.addPendingTask("divLib", "div_batch", { data: 2 }, true);
    }
};
