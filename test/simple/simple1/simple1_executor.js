const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const { WITNESS_ROUND_FULLY_DONE, WITNESS_ROUND_NOTHING_TO_DO } = require("../../../src/witness_calculator_manager.js");

const log = require("../../../logger.js");

class ExecutorSimple1 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple1", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        if(stageId !== 1) return WITNESS_ROUND_NOTHING_TO_DO;

        if(airInstanceId === -1 && stageId !== 1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        if(stageId === 1) {
            let { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(airCtx.subproofCtx, airCtx.airId);

            if (result === false) {
                log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            }
        }

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

        // TODO add numRows for each instance, mnawhile is done for one (first) instance only
        const N = air.numRows;
        const F = airCtx.subproofCtx.F;

        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airCtx.instances[0].wtnsPols.Simple1.a[i] = v;
            airCtx.instances[0].wtnsPols.Simple1.b[i] = F.square(v);
        }
    
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple1;
