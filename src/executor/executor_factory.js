const logger = require("../../logger.js");

class ExecutorFactory {
    static async createExecutor(executorLib) {
        const { default: myClass } = await import(executorLib);
        return new myClass();
    }
}

module.exports = ExecutorFactory;