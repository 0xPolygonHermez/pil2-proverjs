class VerifierFactory {
    static async createVerifier(filename) {
        const { default: myClass } = await import(filename);
        return new myClass();
    }
}

module.exports = VerifierFactory;