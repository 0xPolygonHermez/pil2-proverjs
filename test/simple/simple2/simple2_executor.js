const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");

const { calculatePublics, callCalculateExps, setPol } = require("../../../node_modules/pil2-stark-js/src/prover/prover_helpers.js");
const { extendAndMerkelize } = require("../../../node_modules/pil2-stark-js/src/stark/stark_gen_helpers");

const log = require("../../../logger.js");

class ExecutorSimple2 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple2", proofmanagerAPI);
    }

    async witnessComputationStage0(subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(
            subproofCtx,
            airId
        );

        if (result === false) {
            log.error(
                `[${this.name}]`,
                `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`
            );
            throw new Error(
                `[${this.name}]`,
                `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`
            );
            return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        }

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofId, airId);

        for (let i = 0; i < air.numRows; i++) {
            const v = BigInt(i);

            airInstanceCtx.cmPols.Simple2.a[i] = v;
            airInstanceCtx.cmPols.Simple2.b[i] = proofCtx.F.square(v);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputationStage1(subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[0].ctx;

        log.info(`[${this.name}]`, "> STAGE 1. Compute Trace Column Polynomials");

        calculatePublics(airInstanceCtx);

        if (airInstanceCtx.pilInfo.nLibStages === 0) {
            log.info(`[${this.name}]`, "> Calculating intermediate polynomials");

            await callCalculateExps(
                "stage1",
                "n",
                airInstanceCtx,
                this.settings.parallelExec,
                this.settings.useThreads
            );
        }

        await extendAndMerkelize(1, airInstanceCtx);

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputationStage(stageId, subproofId, airId, proofCtx, subproofCtx) {
        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[0].ctx;

        setChallengesStark(stageId, airInstanceCtx, proofCtx.challenges[stageId], log);

        await callCalculateExps(`stage${stageId}`, "n", airInstanceCtx, this.settings.parallelExec, this.settings.useThreads);

        for (let i = 0; i < airInstanceCtx.pilInfo.hints.length; i++) {
            const hint = airInstanceCtx.pilInfo.hints[i];
            if (hint.stage !== stageId) continue;

            const inputs = [];
            for (let j = 0; j < hint.inputs.length; ++j) {
                const inputIdx = airInstanceCtx.pilInfo.cmPolsMap.findIndex(
                    (c) => c.name === hint.inputs[j]
                );
                const pol = getPol(airInstanceCtx, inputIdx, "n");
                inputs.push(pol);
            }
            const outputs = await hintFunctions(hint.lib, airInstanceCtx.F, inputs);
            for (let j = 0; j < hint.outputs.length; ++j) {
                const outputIdx = airInstanceCtx.pilInfo.cmPolsMap.findIndex(
                    (c) => c.name === hint.outputs[j]
                );
                setPol(airInstanceCtx, outputIdx, outputs[j], "n");
            }
        }

        await extendAndMerkelize(stageId, ctx, log);
    }
}

module.exports = ExecutorSimple2;
