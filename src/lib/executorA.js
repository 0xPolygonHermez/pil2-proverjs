const { ExecutorComponent } = require("../executor/executor.js");
const logger = require('../../logger.js');

const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../executor/executor.js");

class ExecutorA extends ExecutorComponent {
    constructor() {
        super("Executor Type A");
        this.initialized = false;
        this.nSteps = 2;
        this.step = 0;
        this.lastStageId = -1;
    }

    initialize() {
        logger.info(`[ExecutorA] ${this.name}: Initializing.`);

        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[ExecutorA] ${this.name}: not initialized.`);
        }
    }

    witnessComputation(stageId) {
        this.checkInitialized();

        if(stageId !== this.lastStageId) {
            this.lastStageId = stageId;
            this.step = 0;
        }

        logger.info(`[ExecutorA] ${this.name}: Computing witness for stage ${stageId}.`);

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