const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const log = require("../../../logger.js");

class ExecutorSimple3 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple2", proofmanagerAPI);
    }

    async witnessComputationStage0(subproofId, airId, subproofCtx) {
        this.checkInitialized();

        const { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(subproofCtx, airId);

        if (result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        }

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofId, airId);

        getFixedPolsPil2(air, airInstanceCtx.cnstPols, subproofCtx.F);

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

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputation(stageId, airInstanceCtx) {
        const ctx = airInstanceCtx.ctx;
        
        if(stageId === 1) {
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
                if(logger) {
                    logger.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);
                }
                await callCalculateExps(`stage${stageId}`, constraint, dom, ctx, this.settings.parallelExec, this.settings.useThreads, true);
            }
        }
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple3;
