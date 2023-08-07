const {
    ExecutorComponent,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../executor.js");
const log = require("../../../logger.js");

class ExecutorB extends ExecutorComponent {
    constructor(proofManagerAPI) {
        super("Executor Type B", proofManagerAPI);
        this.initialized = false;
        this.nSteps = 1;
        this.step = 0;
        this.lastStageId = -1;
    }

    initialize() {
        log.info("[ExecutorB]", `${this.name}: Initializing.`);

        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[ExecutorB] ${this.name}: not initialized.`);
        }
    }

    witnessComputation(stageId) {
        this.checkInitialized();

        log.info("[ExecutorB]", `--> ${this.name}: Computing witness for stage ${stageId}.`);

        this.step++;
        let status = this.step >= this.nSteps ? WITNESS_ROUND_FULLY_DONE : WITNESS_ROUND_PARTIAL_DONE;

        let msg;
        if (status === WITNESS_ROUND_FULLY_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} finished.`;
        } else if (status === WITNESS_ROUND_PARTIAL_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} in progress.`
        } else if (status === WITNESS_ROUND_NOTHING_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} not started.`
        }
        log.info("[ExecutorB]", msg);

        return status;
    }
}

module.exports = ExecutorB;