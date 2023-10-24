const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Simple3Ex", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        if(stageId !== 1) return;

        if(instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        // For this test we only use airsCtx[0]
        const airCtx = subproofCtx.airsCtx[0];

        let { result, airInstanceCtx } = this.proofCtx.addAirInstance(airCtx.subproofId, airCtx.airId);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const N = airCtx.layout.numRows;
        const F = subproofCtx.proofCtx.F;
        
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[0][0][i] = v;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[0][1][i] = v + 1n;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[0][2][i] = v + 2n;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));

            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[1][0][i] = v;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[1][1][i] = v - 1n;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.a[1][2][i] = v - 2n;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple3.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
        }
    
        return;
    }
}

module.exports = ExecutorSimple3;
