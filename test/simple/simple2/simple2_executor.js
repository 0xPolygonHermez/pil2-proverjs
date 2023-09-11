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
const { computeQStark } = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const log = require("../../../logger.js");

class ExecutorSimple2 extends WitnessCalculatorComponent {
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
        for (let i = 0; i < N; i++) {
            const v = BigInt(i);

            airInstanceCtx.cmmtPols.Simple2.a[i] = v;
            airInstanceCtx.cmmtPols.Simple2.c[(i + 3) % N] = v + 1n;
            airInstanceCtx.cmmtPols.Simple2.b[(i + N - 2) % N] = subproofCtx.F.mul(v, v + 1n);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputation(stageId, subproofId, airId, instanceId, subproofCtx) {
        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[instanceId].ctx;

        if(stageId === 1) {
            await calculatePublics(airInstanceCtx);
        }
        
        const qStage = airInstanceCtx.pilInfo.numChallenges.length + 1;

        const dom = stageId === airInstanceCtx.pilInfo.numChallenges.length + 1 ? "ext" : "n";

        await callCalculateExps(`stage${stageId}`, dom, airInstanceCtx, this.settings.parallelExec, this.settings.useThreads);
    
        await applyHints(stageId, airInstanceCtx);

        if(stageId === qStage) {
            await computeQStark(airInstanceCtx, log);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorSimple2;
