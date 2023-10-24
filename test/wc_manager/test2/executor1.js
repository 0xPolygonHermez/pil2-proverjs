const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Executor1", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        await this.wcManager.readData(this, "A");
    }
};
