const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const { setPol } = require("pil2-stark-js/src/prover/prover_helpers.js");

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
        } else if(stageId === 2) {
            const instance = this.proofCtx.instances[instanceId];
            const gsumName = "Module.gsum";
            const polIdx = instance.ctx.pilInfo.cmPolsMap.findIndex(c => c.name === gsumName);

            const airCtx = subproofCtx.airsCtx[airId];

            // Calculate the gsum polynomial
            const gsum = this.createGsumTrace(airCtx, instance);

            setPol(instance.ctx, polIdx, gsum, "n");
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
            // console.log(polX[i], polQ[i], polX_mod[i]);
        }

        // for(let i = 0; i < N; i++) {
        //     console.log(polX[i], polQ[i], polX_mod[i]);
        //     // console.log(polX[i], "===", F.add(F.mul(polQ[i], mod), polX_mod[i]));
        // }
    }

    createGsumTrace(airCtx, instance) {
        const numRows = airCtx.layout.numRows;

        const MODULE_ID = 1n;
        const stageId = 2;
        const F = this.proofCtx.F;

        const std_alpha_airout = this.proofCtx.airout.getSymbolByName("std_alpha");
        const std_beta_airout = this.proofCtx.airout.getSymbolByName("std_beta");

        if(std_alpha_airout.stage !== stageId || std_beta_airout.stage !== stageId) {
            log.error(`[${this.name}]`, `std_alpha or std_beta not in stage ${stageId}.`);
            throw new Error(`[${this.name}]`, `std_alpha or std_beta not in stage ${stageId}.`);
        }

        const std_alpha = this.proofCtx.challenges[stageId - 1][std_alpha_airout.id];
        const std_beta = this.proofCtx.challenges[stageId - 1][std_beta_airout.id];

        const den = new Array(airCtx.layout.numRows);

        const polX = instance.wtnsPols.Module.x;
        const polX_mod = instance.wtnsPols.Module.x_mod;

        for (let i = 0; i < numRows; i++) {
            den[i] = gsumitem(polX[i], polX_mod[i], std_alpha, std_beta, MODULE_ID);
        }

        //TODO apply montgomery batch division
        for (let i = 0; i < numRows; i++) {
            den[i] = F.div(F.one, den[i]);
            if(i!==0) den[i] = F.add(den[i], den[i-1]);
        }

        instance.ctx.subproofValues.push(den[numRows - 1]);
        return den;

        function gsumitem(x, x_mod, alpha, beta, MODULE_ID) {
            const t1 = MODULE_ID;
            const t2 = beta;
            const t3 = F.mul(alpha, x);
            const t4 = F.mul(F.square(alpha), x_mod);

            return F.add(F.add(F.add(t1, t2), t3), t4);
        }
    }   
}

module.exports = FibonacciVadcopModule;