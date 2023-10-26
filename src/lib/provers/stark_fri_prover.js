const ProverComponent = require("../../prover.js");
const { PROVER_OPENINGS_COMPLETED, PROVER_OPENINGS_PENDING } = require("../../provers_manager.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup.js");
const starkGen = require("pil2-stark-js/src/stark/stark_gen.js");
const { initProverStark,
    computeEvalsStark,
    computeFRIStark,
    genProofStark,
    extendAndMerkelize,
    getPermutationsStark,
    computeFRIFolding,
    computeFRIQueries,
    computeQStark,
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const path = require("path");

const log = require('../../../logger.js');

class StarkFriProver extends ProverComponent {
    constructor(proofCtx) {
        super("FRI Prover", proofCtx);
    }

    initialize(settings, options) {
        super.initialize(settings, options);

        this.options.logger = log;

        const starkStructFilename =  path.join(__dirname, "../../..",  settings.starkStruct);
        this.starkStruct = require(starkStructFilename);
    }

    async setup(airCtx) {
        const subproofCtx = airCtx.subproofCtx;
        const airout = this.proofCtx.getAirout();
        const airSymbols = airout.getSymbolsBySubproofIdAirId(subproofCtx.subproofId, airCtx.airId);

        const air = airout.getAirBySubproofIdAirId(subproofCtx.subproofId, airCtx.airId);

        const fixedPols = newConstantPolsArrayPil2(airSymbols, airCtx.layout.numRows, subproofCtx.F);

        getFixedPolsPil2(air, fixedPols, subproofCtx.F);

        const options = {
            F: subproofCtx.F,
            pil1: false,
        };

        airCtx.setup = await starkSetup(fixedPols, air, this.starkStruct, options);
        airCtx.setup.name = (airCtx.name ? airCtx.name : airCtx.airId) + "-" + airCtx.layout.numRows;;
        airCtx.setup.fixedPols = fixedPols;
    }

    // TODO instances has to be here or to be called from provers manager?
    async newProof(airCtx, publics) {
        const instances = this.proofCtx.getInstancesBySubproofIdAirId(airCtx.subproofId, airCtx.airId);
        for (const airInstance of instances) {   
            airInstance.ctx = await initProverStark(airCtx.setup.starkInfo, airCtx.setup.fixedPols, airCtx.setup.constTree, this.options);                   
            airInstance.publics = publics;
        }
    }

    async verifyPil(stageId, instance) {
        const ctx = instance.ctx;

        ctx.errors = [];

        const nConstraintsStage = ctx.pilInfo.constraints[`stage${stageId}`].length;
        for(let i = 0; i < nConstraintsStage; i++) {
            const constraint = ctx.pilInfo.constraints[`stage${stageId}`][i];
            log.info(`[${this.name}]`, `··· Checking constraint ${i + 1}/${nConstraintsStage}: ${constraint.line} `);
            await callCalculateExps(`stage${stageId}`, constraint, "n", ctx, this.options.parallelExec, this.options.useThreads, true);
        }

        const isValid = ctx.errors.length === 0;
        
        if (!isValid) {
            log.error(`[${this.name}]`, `PIL constraints have not been fulfilled!`);
            for (let i = 0; i < ctx.errors.length; i++) log.error(`[${this.name}]`, ctx.errors[i]);
        }

        return isValid;
    }

    async commitStage(stageId, airInstance) {
        this.checkInitialized();

        const airout = this.proofCtx.getAirout();
        const ctx = airInstance.ctx;

        if (stageId === 1) {
            airInstance.wtnsPols.writeToBigBuffer(ctx.cm1_n, ctx.pilInfo.mapSectionsN.cm1);
            this.calculatePublics(airInstance);
        }

        if(stageId <= airout.numStages + 1) {
            const qStage = ctx.pilInfo.numChallenges.length + 1;

            if(this.options.debug) {
                ctx.errors = [];
                if(stageId === qStage) return;
            }

            const dom = stageId === qStage ? "ext" : "n";

            await callCalculateExps(`stage${stageId}`, ctx.pilInfo.code[`stage${stageId}`], dom, ctx, this.settings.parallelExec, this.settings.useThreads, false);
        
            await applyHints(stageId, ctx);

            if(this.options.debug && stageId !== qStage) {
                const nConstraintsStage = ctx.pilInfo.constraints[`stage${stageId}`].length;

                for(let i = 0; i < nConstraintsStage; i++) {
                    const constraint = ctx.pilInfo.constraints[`stage${stageId}`][i];                    
                    log.debug(` Checking constraint ${i + 1}/${nConstraintsStage}: line ${constraint.line} `);
                    await callCalculateExps(`stage${stageId}`, constraint, dom, ctx, this.settings.parallelExec, this.settings.useThreads, true);
                }
            }
        }

        if(!this.options.debug) {
            let commits = stageId === airout.numStages + 1 ? await computeQStark(ctx, log) : await extendAndMerkelize(stageId, ctx, log);
            ctx.challengeValue = commits;
        } else {
            ctx.challengeValue = ctx.F.randomValue();
        }
    }

    async calculatePublics(airInstance) {
        const ctx = airInstance.ctx;
        calculatePublics(ctx, airInstance.publics);
    }

    async openingStage(openingId, airInstance) {
        this.checkInitialized();

        const isLastRound = openingId === 2 + airInstance.ctx.pilInfo.starkStruct.steps.length + 1;
        const numStages = this.proofCtx.getAirout().numStages + 1;

        if(openingId === 1) {
            await this.computeOpenings(airInstance);
        } else if(openingId === 2) {
            await this.computeFRIStark(airInstance);
        } else if(openingId <= 2 + airInstance.ctx.pilInfo.starkStruct.steps.length) {
            await this.computeFRIFolding(numStages + openingId, airInstance, { step: openingId - 3});
        } else if(openingId === 2 + airInstance.ctx.pilInfo.starkStruct.steps.length + 1) {
            await this.computeFRIQueries(numStages + openingId, airInstance);
        } else {
            log.error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
            throw new Error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
        }

        return isLastRound ? PROVER_OPENINGS_COMPLETED : PROVER_OPENINGS_PENDING;
    }

    async computeOpenings(airInstance) {
        const ctx = airInstance.ctx;

        const subproofCtx = this.proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `··· Computing Openings for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const evalCommits = await computeEvalsStark(ctx, this.options);
        
        ctx.challengeValue = evalCommits;
    }

    async computeFRIStark(airInstance) {
        const ctx = airInstance.ctx;

        const subproofCtx = this.proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `··· Computing FRI Stark for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        await computeFRIStark(ctx, this.options);

        ctx.challengeValue = [];
    }

    async computeFRIFolding(stageId, airInstance, params) {
        const challenge = this.proofCtx.getChallenge(stageId - 1)[0];
        const ctx = airInstance.ctx;

        const subproofCtx = this.proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `··· Computing FRI Folding for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const friCommits = await computeFRIFolding(params.step, ctx, challenge, this.options);

        ctx.challengeValue = friCommits;
    }

    async computeFRIQueries(stageId, airInstance) {
        const ctx = airInstance.ctx;

        const challenge = this.proofCtx.getChallenge(stageId - 1)[0];
        
        const friQueries = await getPermutationsStark(ctx, challenge);

        log.debug("··· FRI queries: [" + friQueries.join(",") + "]");

        computeFRIQueries(ctx, friQueries);

        this.proofCtx.instances[airInstance.instanceId].proof = await genProofStark(ctx, log);
    }    

}

module.exports = StarkFriProver;
