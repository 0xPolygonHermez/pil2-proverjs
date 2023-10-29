const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Executor1", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofId, airId, instanceId) {
        await this.addBusPayload("Executor2", "newInstance", { data: 2 }, false);
    }
}