class ProverFactory {
    static async createProver(proverLib) {
        const { default: myClass } = await import(proverLib);
        return new myClass();
    }
}

module.exports = ProverFactory;