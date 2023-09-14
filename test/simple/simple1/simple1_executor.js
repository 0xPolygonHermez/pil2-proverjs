const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const {
    calculatePublics,
    callCalculateExps,
    applyHints
} = require("pil2-stark-js/src/prover/prover_helpers.js");
const { computeQStark } = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const log = require("../../../logger.js");

class ExecutorSimple1 extends WitnessCalculatorComponent {
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

        for (let i = 0; i < air.numRows; i++) {
            const v = BigInt(i);

            airInstanceCtx.cmmtPols.Simple1.a[i] = v;
            airInstanceCtx.cmmtPols.Simple1.b[i] = subproofCtx.F.square(v);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputation(stageId, subproofId, airId, instanceId, subproofCtx) {
        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[instanceId].ctx;

        if(stageId === 1) {
            await calculatePublics(airInstanceCtx);
        }
        
        const qStage = airInstanceCtx.pilInfo.numChallenges.length + 1;

        const dom = stageId === qStage ? "ext" : "n";

        await callCalculateExps(`stage${stageId}`, airInstanceCtx.pilInfo.code[`stage${stageId}`], dom, airInstanceCtx, this.settings.parallelExec, this.settings.useThreads, false);
    
        await applyHints(stageId, airInstanceCtx);

        if(stageId !== qStage && this.options.debug) {
            const nConstraintsStage = airInstanceCtx.pilInfo.constraints[`stage${stageId}`].length;

            for(let i = 0; i < nConstraintsStage; i++) {
                const constraint = airInstanceCtx.pilInfo.constraints[`stage${stageId}`][i];
                if(logger) {
                    logger.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);
                }
                await callCalculateExps(`stage${stageId}`, constraint, dom, airInstanceCtx, this.settings.parallelExec, this.settings.useThreads, true);
            }
        }
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple1;
