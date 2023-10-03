const {
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../src/witness_calculator_component.js");

const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const log = require("../../logger.js");

class ExecutorFibonacci extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
    }

    async witnessComputation(stageId, airInstanceCtx) {
        const ctx = airInstanceCtx.ctx;
        
        if(stageId > 2) {
            return WITNESS_ROUND_NOTHING_TO_DO;
        }

        if(stageId === 1) {
            const subproofCtx = airInstanceCtx.airCtx.subproofCtx;
            const airCtx = airInstanceCtx.airCtx;
            const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(airCtx.subproofCtx.subproofId, airCtx.airId);

            const N = air.numRows;
            const F = subproofCtx.F;
    
            airInstanceCtx.cmmtPols.Fibonacci.b[0] = 1n;
            airInstanceCtx.cmmtPols.Fibonacci.a[0] = 2n;
            for (let i = 1; i < N; i++) {
                const polA = airInstanceCtx.cmmtPols.Fibonacci.a;
                const polB = airInstanceCtx.cmmtPols.Fibonacci.b;
    
                polB[i] = polA[i-1];
                polA[i] = F.add(F.square(polB[i-1]), F.square(polA[i-1]));    
            }    
    
            airInstanceCtx.cmmtPols.writeToBigBuffer(airInstanceCtx.ctx.cm1_n, airInstanceCtx.ctx.pilInfo.mapSectionsN.cm1);

            await calculatePublics(ctx);
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

module.exports = ExecutorFibonacci;