const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Simple3Ex", wcManager, proofCtx);
    }

    async witnessComputation(stageId, airgroupId, airInstance) {
        if(stageId !== 1) return;

        if(airInstance.instanceId !== -1) {
            log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
        }

        // For tests purposes we only use airId === 0
        airInstance.airId = 0;
        const air = this.proofCtx.airout.airgroups[airgroupId].airs[airInstance.airId];

        let result = this.proofCtx.addAirInstance(airgroupId, airInstance, air.numRows);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        }

        const N = airInstance.layout.numRows;
        const F = this.proofCtx.F;
        
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airInstance.wtnsPols.Simple3.a[0][0][i] = v;
            airInstance.wtnsPols.Simple3.a[0][1][i] = v + 1n;
            airInstance.wtnsPols.Simple3.a[0][2][i] = v + 2n;
            airInstance.wtnsPols.Simple3.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));

            airInstance.wtnsPols.Simple3.a[1][0][i] = v;
            airInstance.wtnsPols.Simple3.a[1][1][i] = v - 1n;
            airInstance.wtnsPols.Simple3.a[1][2][i] = v - 2n;
            airInstance.wtnsPols.Simple3.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
        }
    
        return;
    }
}

module.exports = ExecutorSimple3;
