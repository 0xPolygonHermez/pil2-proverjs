const { WitnessCalculatorComponent } = require("../../witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class DivModule extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("div_lib", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, instanceId) {
        const tasks = this.getPendingTasksByRecipient(this.name);

        for(const task of tasks) {
            log.info(`[${this.name}]`, ` Resolving task: ${task.taskId}`);
            this.resolvePendingTask(task.taskId);
        }
    }
}