class WitnessCalculatorFactory {
    static async createWitnessCalculator(witnesscalculatorLib, wcManager, proofmanagerAPI) {
        const { default: myClass } = await import(witnesscalculatorLib);
        return new myClass(wcManager, proofmanagerAPI);
    }
}

module.exports = WitnessCalculatorFactory;