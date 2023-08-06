const ExecutorA = require("./executorA.js");
const ExecutorB = require("./executorB.js");

const logger = require("../../logger.js");

class ExecutorFactory {
    static createExecutor(type) {
        switch (type) {
            case "executorA":
                return new ExecutorA();
            case "executorB":
                return new ExecutorB();
            default:
                logger.error(
                    "[ExecutorFactory] Invalid Executor type"
                );
                throw new Error("Invalid Executor type");
        }
    }
}

module.exports = ExecutorFactory;