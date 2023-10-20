const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(wcManager, proofmanagerAPI) {
        super("Executor2", wcManager, proofmanagerAPI);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        const tasks = this.getPendingTasksByRecipient(this.name);

        for(const task of tasks) {
            log.info(`[${this.name}]`, `Resolving task: ${task.taskId}`);                
            this.resolvePendingTask(task.taskId);
        }
    }
}