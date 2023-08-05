const { ExecutorComponent } = require("./executor.js");
const logger = require('../../logger.js');

class ExecutorA extends ExecutorComponent {
    constructor() {
        super("Executor Type A");
    }

    witnessComputation() {
        logger.info(`[ExecutorA] ${this.name}: Resolving constraints...`);
    }
}

module.exports = ExecutorA;