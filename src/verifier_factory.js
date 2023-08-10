class VerifierFactory {
    static async createVerifier(verifierLib, piloutproverAPI) {
        const { default: myClass } = await import(verifierLib);
        return new myClass(piloutproverAPI);
    }
}

module.exports = VerifierFactory;