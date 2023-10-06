const {
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple3", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        if(stageId !== 1) return WITNESS_ROUND_NOTHING_TO_DO;

        const airCtx = airInstanceCtx.airCtx;
        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        const N = air.numRows;
        const F = airCtx.subproofCtx.F;
        
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airInstanceCtx.wtnsPols.Simple3.a[0][0][i] = v;
            airInstanceCtx.wtnsPols.Simple3.a[0][1][i] = v + 1n;
            airInstanceCtx.wtnsPols.Simple3.a[0][2][i] = v + 2n;
            airInstanceCtx.wtnsPols.Simple3.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));

            airInstanceCtx.wtnsPols.Simple3.a[1][0][i] = v;
            airInstanceCtx.wtnsPols.Simple3.a[1][1][i] = v - 1n;
            airInstanceCtx.wtnsPols.Simple3.a[1][2][i] = v - 2n;
            airInstanceCtx.wtnsPols.Simple3.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
        }
    
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple3;
