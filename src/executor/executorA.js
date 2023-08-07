const { ExecutorComponent } = require("./executor.js");
const logger = require('../../logger.js');

const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("./executor.js");

class ExecutorA extends ExecutorComponent {
    constructor() {
        super("Executor Type A");
        this.nSteps = 3;
        this.step = 0;
    }

    witnessComputation(stageId) {
        logger.info(`[ExecutorA] ${this.name}: Computing witness for stage ${stageId}.`);
return WITNESS_ROUND_FULLY_DONE;
        this.step++;
        let status = this.step >= this.nSteps ? WITNESS_ROUND_FULLY_DONE : WITNESS_ROUND_PARTIAL_DONE;

        if(status === WITNESS_ROUND_FULLY_DONE) {
            logger.info(`[ExecutorA] ${this.name}: Witness computation for stage ${stageId} finished.`);
        } else if(status === WITNESS_ROUND_PARTIAL_DONE) {
            logger.info(`[ExecutorA] ${this.name}: Witness computation for stage ${stageId} in progress.`);
        } else if(status === WITNESS_ROUND_NOTHING_DONE) {
            logger.info(`[ExecutorA] ${this.name}: Witness computation for stage ${stageId} not started.`);
        }

        return status;
    }
}

module.exports = ExecutorA;