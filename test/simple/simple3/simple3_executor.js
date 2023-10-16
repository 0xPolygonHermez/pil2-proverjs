const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple3", proofmanagerAPI);
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
        
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airCtx.instances[0].wtnsPols.Simple3.a[0][0][i] = v;
            airCtx.instances[0].wtnsPols.Simple3.a[0][1][i] = v + 1n;
            airCtx.instances[0].wtnsPols.Simple3.a[0][2][i] = v + 2n;
            airCtx.instances[0].wtnsPols.Simple3.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));

            airCtx.instances[0].wtnsPols.Simple3.a[1][0][i] = v;
            airCtx.instances[0].wtnsPols.Simple3.a[1][1][i] = v - 1n;
            airCtx.instances[0].wtnsPols.Simple3.a[1][2][i] = v - 2n;
            airCtx.instances[0].wtnsPols.Simple3.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
        }
    
        return;
    }
}

module.exports = ExecutorSimple3;
