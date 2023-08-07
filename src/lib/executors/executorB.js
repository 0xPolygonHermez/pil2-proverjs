const {
    ExecutorComponent,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../executor/executor.js");
const logger = require("../../../logger.js");

class ExecutorB extends ExecutorComponent {
    constructor() {
        super("Executor Type B");
        this.initialized = false;
        this.nSteps = 1;
        this.step = 0;
        this.lastStageId = -1;
    }

    initialize() {
        logger.info(`[ExecutorB] ${this.name}: Initializing.`);

        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[ExecutorB] ${this.name}: not initialized.`);
        }
    }

    witnessComputation(stageId) {
        this.checkInitialized();

        logger.info(`[ExecutorB] ${this.name}: Computing witness for stage ${stageId}.`);

        this.step++;
        let status = this.step >= this.nSteps ? WITNESS_ROUND_FULLY_DONE : WITNESS_ROUND_PARTIAL_DONE;

        if(status === WITNESS_ROUND_FULLY_DONE) {
            logger.info(`[ExecutorB] ${this.name}: Witness computation for stage ${stageId} finished.`);
        } else if(status === WITNESS_ROUND_PARTIAL_DONE) {
            logger.info(`[ExecutorB] ${this.name}: Witness computation for stage ${stageId} in progress.`);
        } else if(status === WITNESS_ROUND_NOTHING_DONE) {
            logger.info(`[ExecutorB] ${this.name}: Witness computation for stage ${stageId} not started.`);
        }

        return status;
    }
}

module.exports = ExecutorB;