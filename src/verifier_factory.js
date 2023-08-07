class VerifierFactory {
    static async createVerifier(verifierLib) {
        const { default: myClass } = await import(verifierLib);
        return new myClass();
    }
}

module.exports = VerifierFactory;