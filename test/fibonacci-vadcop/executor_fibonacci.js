const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const {
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const log = require("../../logger.js");

class FibonacciVadcop extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("FibonccExe", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId, publics) { 
        if(stageId === 1) {
            if(instanceId !== -1) {
                log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
                throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            }

            /// NOTE: Here we decide for test purposes to create a fibonacci 2**4 and a module 2**4
            await this.wcManager.writeData(this, "Module.createInstances", {"airId": 0});
            const airCtx = subproofCtx.airsCtx[1];

            log.info(`[${this.name}]`, `Creating air instance for air '${airCtx.name}' with N=${airCtx.layout.numRows} rows.`)
            let { result, airInstance } = this.proofCtx.addAirInstance(airCtx.subproofId, airCtx.airId);

            if (result === false) {
                log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            }
        
            this.createPolynomialTraces(subproofCtx, airCtx, airInstance,  publics);
        }

        return;
    }

    createPolynomialTraces(subproofCtx, airCtx, airInstance, publics) {
        const N = airCtx.layout.numRows;
        const F = subproofCtx.proofCtx.F;

        const mod = publics.mod;

        const polA = airInstance.wtnsPols.Fibonacci.a;
        const polB = airInstance.wtnsPols.Fibonacci.b;

        polB[0] = publics.in1;
        polA[0] = publics.in2;

        // console.log(polA[0], polB[0]);
        for (let i = 1; i < N; i++) {
            polA[i] = (polA[i - 1]*polA[i - 1] + polB[i - 1]*polB[i - 1]) % mod;
            polB[i] = polA[i-1];

            // console.log(polA[i], polB[i]);
        }

        publics.out = polA[N-1];
    }
}

module.exports = FibonacciVadcop;