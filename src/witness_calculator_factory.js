class WitnessCalculatorFactory {
    static async createWitnessCalculator(witnesscalculatorLib, wcManager, proofSharedMemory) {
        const { default: myClass } = await import(witnesscalculatorLib);
        return new myClass(wcManager, proofSharedMemory);
    }
}

module.exports = WitnessCalculatorFactory;