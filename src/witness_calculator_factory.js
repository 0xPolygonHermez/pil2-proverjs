class WitnessCalculatorFactory {
    static async createWitnessCalculator(witnesscalculatorLib, piloutproverAPI) {
        const { default: myClass } = await import(witnesscalculatorLib);
        return new myClass(piloutproverAPI);
    }
}

module.exports = WitnessCalculatorFactory;