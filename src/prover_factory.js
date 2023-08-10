class ProverFactory {
    static async createProver(proverLib, piloutproverAPI) {
        const { default: myClass } = await import(proverLib);
        return new myClass(piloutproverAPI);
    }
}

module.exports = ProverFactory;