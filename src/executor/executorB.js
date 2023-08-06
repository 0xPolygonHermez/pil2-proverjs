const { ExecutorComponent } = require("./executor.js");
const logger = require('../../logger.js');

class ExecutorB extends ExecutorComponent {
    constructor() {
        super("Executor Type B");
    }

    witnessComputation(stageId) {
        logger.info(`[ExecutorA] ${this.name}: Computing witness for stage ${stageId}.`);
    }
}

module.exports = ExecutorB;