class VerifierFactory {
    static async createVerifier(verifierLib, proofManagerAPI) {
        const { default: myClass } = await import(verifierLib);
        return new myClass(proofManagerAPI);
    }
}

module.exports = VerifierFactory;