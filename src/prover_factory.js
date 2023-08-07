class ProverFactory {
    static async createProver(proverLib, proofManagerAPI) {
        const { default: myClass } = await import(proverLib);
        return new myClass(proofManagerAPI);
    }
}

module.exports = ProverFactory;