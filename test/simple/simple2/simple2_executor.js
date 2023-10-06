const {
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple2", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        if(stageId !== 1) return WITNESS_ROUND_NOTHING_TO_DO;

        const airCtx = airInstanceCtx.airCtx;
        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        const N = air.numRows;
        const F = airCtx.subproofCtx.F;

        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airInstanceCtx.wtnsPols.Simple2.a[i] = v;
            airInstanceCtx.wtnsPols.Simple2.c[(i + 3) % N] = v + 1n;
            airInstanceCtx.wtnsPols.Simple2.b[(i + N - 2) % N] = F.mul(v, v + 1n);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple2;
