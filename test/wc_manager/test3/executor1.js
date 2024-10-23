const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Executor1", wcManager, proofCtx);
    }

    async witnessComputation(stageId, airgroupId, airId, instanceId) {
        await this.wcManager.addNotification(this.name, "divLib", "div_batch", { data: 2 }, true);
        await this.wcManager.addNotification(this.name, "divLib", "div_batch", { data: 2 }, true);
        await this.wcManager.addNotification(this.name, "divLib", "div_batch", { data: 2 }, true);
    }
};
