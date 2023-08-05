const { ExecutorComponent } = require("./executor.js");
const logger = require('../../logger.js');

class ExecutorB extends ExecutorComponent {
    constructor() {
        super("Executor Type B");
    }

    witnessComputation() {
        logger.info(`[ExecutorB] ${this.name}: Resolving constraints...`);
    }
}

module.exports = ExecutorB;