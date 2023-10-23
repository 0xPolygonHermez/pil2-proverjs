class ProverFactory {
    static async createProver(filename, proofSharedMemory) {
        const { default: myClass } = await import(filename);
        return new myClass(proofSharedMemory);
    }
}

module.exports = ProverFactory;