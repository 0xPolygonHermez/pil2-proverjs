const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const { setPol } = require("pil2-stark-js/src/prover/prover_helpers.js");

const log = require("../../logger.js");

class FibonacciVadcop extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("FibonccExe", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId, publics) { 
        if(stageId === 1) {
            if(instanceId !== -1) {
                log.error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
                throw new Error(`[${this.name}]`, `Air instance id already existing in stageId 1.`);
            }

            /// NOTE: Here we decide for test purposes to create a fibonacci 2**4 and a module 2**4
            await this.wcManager.writeData(this, "Module.createInstances", {"airId": 0});
            const airCtx = subproofCtx.airsCtx[1];

            log.info(`[${this.name}]`, `Creating air instance for air '${airCtx.name}' with N=${airCtx.layout.numRows} rows.`)
            let { result, airInstance } = this.proofCtx.addAirInstance(airCtx.subproofId, airCtx.airId);

            if (result === false) {
                log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            }
        
            this.createPolynomialTraces(subproofCtx, airCtx, airInstance,  publics);
        } else if(stageId === 2) {
            console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
            const instance = this.proofCtx.instances[instanceId];
            const gsumName = "Fibonacci.gsum";
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

        const mod = publics.mod;

        const polA = airInstance.wtnsPols.Fibonacci.a;
        const polB = airInstance.wtnsPols.Fibonacci.b;

        polB[0] = publics.in1;
        polA[0] = publics.in2;

        // console.log(polA[0], polB[0]);
        for (let i = 1; i < N; i++) {
            polA[i] = (polA[i - 1]*polA[i - 1] + polB[i - 1]*polB[i - 1]) % mod;
            polB[i] = polA[i-1];

            // console.log(polA[i], polB[i]);
        }

        publics.out = polA[N-1];
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

        for (let i = 0; i < numRows; i++) {
            den[i] = F.div(F.negone, MODULE_ID);
        }
        // const polA = instance.wtnsPols.Fibonacci.a;
        // const polB = instance.wtnsPols.Fibonacci.b;

        // den[0] = gsumitem(polA[0], polA[1], polB[0], this.proofCtx.publics.out, std_alpha, std_beta, MODULE_ID, false);
        // for (let i = 1; i < numRows; i++) {
        //     const isLast = i === numRows - 1;
        //     const iPrime = isLast ? 0 : i + 1;
        //     den[i] = gsumitem(polA[i], polA[iPrime], polB[i], this.proofCtx.publics.out, std_alpha, std_beta, MODULE_ID, isLast);
        // }

        // //TODO apply montgomery batch division
        // for (let i = 1; i < numRows; i++) {
        //     den[i] = F.div(F.negone, den[i]);
        // }

        return den;

        function gsumitem(a, aprime, b, out, alpha, beta, MODULE_ID, isLast) {
            const t1 = MODULE_ID;
            const t2 = beta;
            const t3 = F.mul(alpha, F.add(F.square(a), F.square(b)));
            const t4 = F.mul(F.square(alpha), isLast ? out : aprime);

            return F.add(F.add(F.add(t1, t2), t3), t4);
        }
    }   
}

module.exports = FibonacciVadcop;