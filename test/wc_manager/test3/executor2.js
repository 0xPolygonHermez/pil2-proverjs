const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(wcManager, proofSharedMemory) {
        super("Executor2", wcManager, proofSharedMemory);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        await this.addBusPayload("divLib", "div_batch", { data: 2 }, true);
    }
}