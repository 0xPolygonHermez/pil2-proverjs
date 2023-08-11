class WitnessCalculatorFactory {
    static async createWitnessCalculator(witnesscalculatorLib, proofmanagerAPI) {
        const { default: myClass } = await import(witnesscalculatorLib);
        return new myClass(proofmanagerAPI);
    }
}

module.exports = WitnessCalculatorFactory;