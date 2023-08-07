const logger = require('../../logger.js');

const WITNESS_ROUND_NOTHING_DONE = 1;
const WITNESS_ROUND_PARTIAL_DONE = 2;
const WITNESS_ROUND_FULLY_DONE = 3;

// Abstract base class for all Executor components
class ExecutorComponent {
    constructor(name) {
        this.name = name;
    }

    witnessComputation(stageId) {
        throw new Error("Method 'resolve' must be implemented in concrete classes.");
    }
}

// Executor class acting as the composite
class ExecutorComposite extends ExecutorComponent {
    constructor() {
        super("ExecutorComposite");
        this.executors = [];
    }

    registerExecutor(executor) {
        const index = this.executors.length;
        this.executors.push(executor);

        return index;
    }

    unregisterExecutor(index) {
        if (index !== -1) {
            this.executors.splice(index, 1);
        }
    }

    getExecutors() {
        return this.executors;
    }

    witnessComputation(stageId) {
        logger.info(`[ExecutorComposite] Starting witness computation stage ${stageId}`);

        const numExecutors = this.executors.length;
        let executorStatus = Array(numExecutors).fill(WITNESS_ROUND_NOTHING_DONE);
        let nPendingToFinish = numExecutors;
        let x = nPendingToFinish;
        let lastId = -1;

        for(let i = 0; x > 0; i = (i+1) % numExecutors) {
            if(executorStatus[i] === WITNESS_ROUND_FULLY_DONE) continue;

            if(lastId !== -1 && lastId === i) {
                logger.error(`[ExecutorComposite] Executor ${this.executors[i].name} is stuck in witness computation for stage ${stageId}`);
                throw new Error(`Executor ${this.executors[i].name} is stuck in witness computation for stage ${stageId}`);
            }

            const status = this.executors[i].witnessComputation(stageId);

            if(executorStatus[i] !== WITNESS_ROUND_NOTHING_DONE &&
                executorStatus[i] !== WITNESS_ROUND_PARTIAL_DONE &&
                executorStatus[i] !== WITNESS_ROUND_FULLY_DONE) {
                logger.error(`[ExecutorComposite] Unknown executor status return value: ${executorStatus[i]}`);
                throw new Error(`Unknown executor status return value: ${executorStatus[i]}`);
            }

            executorStatus[i] = status;

            if(status === WITNESS_ROUND_FULLY_DONE || status === WITNESS_ROUND_PARTIAL_DONE) {
                lastId = i;
            }
            
            if (executorStatus[i] === WITNESS_ROUND_NOTHING_DONE) x--;
            else if (executorStatus[i] === WITNESS_ROUND_FULLY_DONE) {
                nPendingToFinish--;
                x = nPendingToFinish;
            }
        }

        if(nPendingToFinish !== 0) {
            executorStatus.forEach((status, index) => {
                if(status !== WITNESS_ROUND_FULLY_DONE)
                    logger.error(`[ExecutorComposite] Executor ${this.executors[index].name} did not finish witness computation for stage ${stageId}`);
            });
            logger.error(`[ExecutorComposite] Unable to compute all witnesses for stage ${stageId}`);
            throw new Error(`Unable to compute all witnesses for stage ${stageId}`);
        }

        logger.info(`[ExecutorComposite] Witness computation stage ${stageId} finished`);
    }
}

module.exports = {
    ExecutorComponent,
    ExecutorComposite,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
};