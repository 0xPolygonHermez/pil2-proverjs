class WitnessCalculatorFactory {
    static async createWitnessCalculator(witnesscalculatorLib, wcManager, proofCtx) {
        const { default: myClass } = await import(witnesscalculatorLib);
        return new myClass(wcManager, proofCtx);
    }
}

module.exports = WitnessCalculatorFactory;