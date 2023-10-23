const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const {
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const log = require("../../logger.js");

class FibonacciVadcop extends WitnessCalculatorComponent {
    constructor(wcManager, proofSharedMemory) {
        super("FibonacciExecutor", wcManager, proofSharedMemory);
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

            log.info(`[${this.name}]`, `Creating air instance for air '${airCtx.air.name}' with N=${airCtx.air.numRows} rows.`)
            let { result, airInstanceCtx: instanceCtx } = this.proofSharedMemory.addAirInstance(airCtx.subproofId, airCtx.airId);

            if (result === false) {
                log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            }
        
            // TODO how to instanciate publics ? it will be at subproof level ?
            this.createPolynomialTraces(subproofCtx, airCtx, instanceCtx,  publics);
        }

        return;
    }

    createPolynomialTraces(subproofCtx, airCtx, airInstanceCtx, publics) {
        const N = airCtx.layout.numRows;
        const F = subproofCtx.proofCtx.F;

        const mod = publics.mod;

        const polA = airInstanceCtx.wtnsPols.Fibonacci.a;
        const polB = airInstanceCtx.wtnsPols.Fibonacci.b;

        polB[0] = publics.in1;
        polA[0] = publics.in2;

        for (let i = 1; i < N; i++) {
            polA[i] = F.div(
                F.add(F.square(polA[i - 1]), F.square(polB[i - 1])),
                mod
            );
            polB[i] = polA[i-1];
        }

        publics.out = polA[N-1];
    }
}

module.exports = FibonacciVadcop;