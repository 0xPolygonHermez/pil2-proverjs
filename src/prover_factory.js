class ProverFactory {
    static async createProver(filename, proofmanagerAPI) {
        const { default: myClass } = await import(filename);
        return new myClass(proofmanagerAPI);
    }
}

module.exports = ProverFactory;