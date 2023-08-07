class ExecutorFactory {
    static async createExecutor(executorLib, proofManagerAPI) {
        const { default: myClass } = await import(executorLib);
        return new myClass(proofManagerAPI);
    }
}

module.exports = ExecutorFactory;