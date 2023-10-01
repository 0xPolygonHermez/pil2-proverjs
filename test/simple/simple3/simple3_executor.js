const {
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple3", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        const ctx = airInstanceCtx.ctx;
        
        if(stageId === 1) {
            const subproofCtx = airInstanceCtx.airCtx.subproofCtx;
            const airCtx = airInstanceCtx.airCtx;
            const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

            const N = air.numRows;
            const F = subproofCtx.F;
            for (let i = 0; i < N; i++) {
                const v = BigInt(i);
    
                airInstanceCtx.cmmtPols.Simple3.a[0][0][i] = v;
                airInstanceCtx.cmmtPols.Simple3.a[0][1][i] = v + 1n;
                airInstanceCtx.cmmtPols.Simple3.a[0][2][i] = v + 2n;
                airInstanceCtx.cmmtPols.Simple3.b[0][i] = F.mul(v, F.mul(v + 1n, v + 2n));
    
                airInstanceCtx.cmmtPols.Simple3.a[1][0][i] = v;
                airInstanceCtx.cmmtPols.Simple3.a[1][1][i] = v - 1n;
                airInstanceCtx.cmmtPols.Simple3.a[1][2][i] = v - 2n;
                airInstanceCtx.cmmtPols.Simple3.b[1][i] = F.mul(v, F.mul(v - 1n, v - 2n));
            }
    
            airInstanceCtx.cmmtPols.writeToBigBuffer(airInstanceCtx.ctx.cm1_n, airInstanceCtx.ctx.pilInfo.mapSectionsN.cm1);

            await calculatePublics(ctx);
        } else if(stageId > 2) {
            return WITNESS_ROUND_NOTHING_TO_DO;
        }
                
        const qStage = ctx.pilInfo.numChallenges.length + 1;

        const dom = stageId === qStage ? "ext" : "n";

        await callCalculateExps(`stage${stageId}`, ctx.pilInfo.code[`stage${stageId}`], dom, ctx, this.settings.parallelExec, this.settings.useThreads, false);
    
        await applyHints(stageId, ctx);

        if(stageId !== qStage && this.options.debug) {
            const nConstraintsStage = ctx.pilInfo.constraints[`stage${stageId}`].length;

            for(let i = 0; i < nConstraintsStage; i++) {
                const constraint = ctx.pilInfo.constraints[`stage${stageId}`][i];

                if(log) log.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);

                await callCalculateExps(`stage${stageId}`, constraint, dom, ctx, this.settings.parallelExec, this.settings.useThreads, true);
            }
        }
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple3;
