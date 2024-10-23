const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Executor2", wcManager, proofCtx);
    }

    async witnessComputation(stageId, airgroupId, airId, instanceId) {
        await this.wcManager.addNotification(this.name, "divLib", "div_batch", { data: 2 }, true);
    }
}