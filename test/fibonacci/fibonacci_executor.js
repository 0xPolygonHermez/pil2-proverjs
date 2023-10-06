const {
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../src/witness_calculator_component.js");

const log = require("../../logger.js");

class ExecutorFibonacci extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        if(stageId !== 1) return WITNESS_ROUND_NOTHING_TO_DO;

        const airCtx = airInstanceCtx.airCtx;
        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        const N = air.numRows;
        const F = airCtx.subproofCtx.F;

        airInstanceCtx.wtnsPols.Fibonacci.b[0] = 1n;
        airInstanceCtx.wtnsPols.Fibonacci.a[0] = 2n;
        for (let i = 1; i < N; i++) {
            const polA = airInstanceCtx.wtnsPols.Fibonacci.a;
            const polB = airInstanceCtx.wtnsPols.Fibonacci.b;

            polB[i] = polA[i-1];
            polA[i] = F.add(F.square(polB[i-1]), F.square(polA[i-1]));    
        }    
    
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorFibonacci;