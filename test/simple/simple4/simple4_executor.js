const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple4 extends WitnessCalculatorComponent {
    constructor(wcManager, proofSharedMemory) {
        super("Simple4Ex", wcManager, proofSharedMemory);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        if(stageId !== 1) return;

        if(instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        // For this test we only use airsCtx[0]
        const airCtx = subproofCtx.airsCtx[0];

        let { result, airInstanceCtx } = this.proofSharedMemory.addAirInstance(airCtx.subproofId, airCtx.airId);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const N = airCtx.layout.numRows;
        const F = subproofCtx.proofCtx.F;
        
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            subproofCtx.proofCtx.instances[0].wtnsPols.Simple4.a[i] = v;
            subproofCtx.proofCtx.instances[0].wtnsPols.Simple4.b[i] = F.square(v);
        }
        
        return;
    }
}

module.exports = ExecutorSimple4;
