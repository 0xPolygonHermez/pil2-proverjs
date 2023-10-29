const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple1 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Simple1Ex", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofId, airId, instanceId) {
        if(stageId !== 1) return;

        if(instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        // For tests purposes we only use airId === 0
        airId = 0;
        const air = this.proofCtx.airout.subproofs[subproofId].airs[airId];

        let { result, airInstance } = this.proofCtx.addAirInstance(subproofId, airId, air.numRows);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const N = airInstance.layout.numRows;
        const F = this.proofCtx.F;

        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airInstance.wtnsPols.Simple1.a[i] = v;
            airInstance.wtnsPols.Simple1.b[i] = F.square(v);
        }
    
        return;
    }
}

module.exports = ExecutorSimple1;
