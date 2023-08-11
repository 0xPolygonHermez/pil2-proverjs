class ProverFactory {
    static async createProver(proverLib, proofmanagerAPI) {
        const { default: myClass } = await import(proverLib);
        return new myClass(proofmanagerAPI);
    }
}

module.exports = ProverFactory;