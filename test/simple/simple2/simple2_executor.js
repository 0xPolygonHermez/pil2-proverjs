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

class ExecutorSimple2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple2", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        const ctx = airInstanceCtx.ctx;

        if(stageId === 1) {
            const subproofCtx = airInstanceCtx.airCtx.subproofCtx;
            const airCtx = airInstanceCtx.airCtx;
            const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

            const N = air.numRows;
            for (let i = 0; i < N; i++) {
                const v = BigInt(i);
    
                airInstanceCtx.cmmtPols.Simple2.a[i] = v;
                airInstanceCtx.cmmtPols.Simple2.c[(i + 3) % N] = v + 1n;
                airInstanceCtx.cmmtPols.Simple2.b[(i + N - 2) % N] = subproofCtx.F.mul(v, v + 1n);
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

module.exports = ExecutorSimple2;
