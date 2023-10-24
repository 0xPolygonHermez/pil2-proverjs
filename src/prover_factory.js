class ProverFactory {
    static async createProver(filename, proofCtx) {
        const { default: myClass } = await import(filename);
        return new myClass(proofCtx);
    }
}

module.exports = ProverFactory;