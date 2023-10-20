const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const log = require("../../logger.js");

class ExecutorFibonacci extends WitnessCalculatorComponent {
    constructor(wcManager, proofmanagerAPI) {
        super("FibonacciEx", wcManager, proofmanagerAPI);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId, publics) {
        if(stageId !== 1) return;

        if(instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        // For this test we only use airsCtx[0]
        const airCtx = subproofCtx.airsCtx[0];

        let { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(airCtx.subproofCtx, airCtx.airId);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const air = this.proofmanagerAPI.getAirout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        const N = air.numRows;
        const F = airCtx.subproofCtx.F;

        const polA = airCtx.instances[0].wtnsPols.Fibonacci.a;
        const polB = airCtx.instances[0].wtnsPols.Fibonacci.b;

        polB[0] = publics.in1;
        polA[0] = publics.in2;
        for (let i = 1; i < N; i++) {
            polB[i] = polA[i-1];
            polA[i] = F.add(F.square(polB[i-1]), F.square(polA[i-1]));    
        }

        publics.out = polA[N-1];
    
        return;
    }
}

module.exports = ExecutorFibonacci;