const { ExecutorComponent } = require("./executor.js");
const logger = require('../../logger.js');

class ExecutorA extends ExecutorComponent {
    constructor() {
        super("Executor Type A");
    }

    witnessComputation(stageId) {
        logger.info(`[ExecutorA] ${this.name}: Computing witness for stage ${stageId}.`);
    }
}

module.exports = ExecutorA;