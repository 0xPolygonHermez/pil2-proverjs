const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const log = require("../../logger.js");

class FibonacciVadcopModule extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("ModuleExecutor", wcManager, proofCtx);
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
        const F = subproofCtx.proofCtx.F;

        const polX = airInstance.wtnsPols.Module.x;
        const polQ = airInstance.wtnsPols.Module.q;
        const polX_mod = airInstance.wtnsPols.Module.x_mod;

        let a = new Array(2);
        let b = new Array(2);

        const mod = publics.mod;

        a[0] = publics.in2;
        b[0] = publics.in1;

        for (let i = 0; i < N; i++) {
            a[1] = F.add(F.square(a[0]), F.square(b[0]));
            b[1] = a[0];

            polX[i] = a[1];

            polQ[i] = F.div(polX[i], mod); // TODO, how to get the floor?
            polX_mod[i] = 1n; //F.mod(polX[i], mod);

            a[0] = a[1];
            b[0] = b[1];
            console.log(a[1], b[1]);
        }
    }
}

module.exports = FibonacciVadcopModule;