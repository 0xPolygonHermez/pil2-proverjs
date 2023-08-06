const logger = require('../../logger.js');

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
        logger.info(`[ExecutorComposite] Resolving stage ${stageId}`);
        this.executors.forEach((executor) => {
            executor.witnessComputation(stageId);
        });
    }
}

module.exports.ExecutorComponent = ExecutorComponent;
module.exports.ExecutorComposite = ExecutorComposite;