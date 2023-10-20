const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofmanagerAPI) {
        super("Executor1", wcManager, proofmanagerAPI);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        await this.addBusPayload("Executor2", "newInstance", { data: 2 }, false);
    }
}