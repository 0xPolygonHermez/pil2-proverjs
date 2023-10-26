const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const log = require("../../logger.js");

class FibonacciVadcopModule extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Module Exe", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId, publics) {        
        if(stageId === 1) {            
            if(instanceId !== -1) {
                log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
                throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            }

            const instanceData = await this.wcManager.readData(this, "Module.createInstances");
            const airCtx = subproofCtx.airsCtx[instanceData.airId];

            log.info(`[${this.name}]`, `Creating air instance for air '${airCtx.name}' with N=${airCtx.layout.numRows} rows.`)
            let { result, airInstance } = this.proofCtx.addAirInstance(airCtx.subproofId, airCtx.airId);

            if (result === false) {
                log.error(`[${this.name}]`, `New air instance for air '${airCtx.air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New air instance for air '${airCtx.air.name}' with N=${air.numRows} rows failed.`);
            }
        
            this.createPolynomialTraces(subproofCtx, airCtx, airInstance, publics);
        }
        
        return;
    }

    createPolynomialTraces(subproofCtx, airCtx, airInstance, publics) {
        const N = airCtx.layout.numRows;

        const polX = airInstance.wtnsPols.Module.x;
        const polQ = airInstance.wtnsPols.Module.q;
        const polX_mod = airInstance.wtnsPols.Module.x_mod;

        const mod = publics.mod;

        let a = publics.in2;
        let b = publics.in1;

        for (let i = 0; i < N; i++) {
            polX[i] = a * a + b * b;

            polQ[i] = polX[i] / mod;
            polX_mod[i] = polX[i] % mod;

            b = a;
            a = polX_mod[i];
            console.log(polX[i], polQ[i], polX_mod[i]);
        }

        console.log("Checking polynomials...");
        const F = subproofCtx.proofCtx.F;
        for(let i = 0; i < N; i++) {
            console.log(polX[i], polQ[i], polX_mod[i]);
            // console.log(polX[i], "===", F.add(F.mul(polQ[i], mod), polX_mod[i]));
        }
    }
}

module.exports = FibonacciVadcopModule;