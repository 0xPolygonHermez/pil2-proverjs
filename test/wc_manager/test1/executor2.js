const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const { WITNESS_ROUND_FULLY_DONE } = require("../../../src/witness_calculator_manager.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("Executor2", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        log.info(`[${this.name}]`, `stageId: ${stageId}, airCtx: ${airCtx}, airInstanceId: ${airInstanceId}`);

        const tasks = this.getPendingTasksByRecipient(this.name);
        
        for(const task of tasks) {
            log.info(`[${this.name}]`, `Resolving task: ${task.taskId}`);
            this.resolvePendingTask(task.taskId);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }
}