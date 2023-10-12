const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");
const Mutex = require("../../../src/mutex.js");
const { WITNESS_ROUND_FULLY_DONE } = require("../../../src/witness_calculator_manager.js");

const log = require("../../../logger.js");

module.exports = class Executor1 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor1", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        log.info(`[${this.name}]`, `stageId: ${stageId}, airCtx: ${airCtx}, airInstanceId: ${airInstanceId}`);

        const mutex = new Mutex(true);

        this.addLibPendingTask("Executor2", "createInstances", { num: 2 });
        await mutex.lock();

        return WITNESS_ROUND_FULLY_DONE;
    }
}