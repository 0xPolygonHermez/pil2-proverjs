const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const log = require("../../logger.js");

class ExecutorFibonacci extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, instanceId) {
        if(stageId !== 1) return;

        if(instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        let { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(airCtx.subproofCtx, airCtx.airId);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        // TODO add numRows for each instance, mnawhile is done for one (first) instance only
        const N = air.numRows;
        const F = airCtx.subproofCtx.F;

        airCtx.instances[0].wtnsPols.Fibonacci.b[0] = 1n;
        airCtx.instances[0].wtnsPols.Fibonacci.a[0] = 2n;
        for (let i = 1; i < N; i++) {
            const polA = airCtx.instances[0].wtnsPols.Fibonacci.a;
            const polB = airCtx.instances[0].wtnsPols.Fibonacci.b;

            polB[i] = polA[i-1];
            polA[i] = F.add(F.square(polB[i-1]), F.square(polA[i-1]));    
        }    
    
        return;
    }
}

module.exports = ExecutorFibonacci;