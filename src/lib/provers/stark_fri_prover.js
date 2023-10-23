const ProverComponent = require("../../prover.js");
const { PROVER_OPENINGS_COMPLETED, PROVER_OPENINGS_PENDING } = require("../../provers_manager.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup.js");
const starkGen = require("pil2-stark-js/src/stark/stark_gen.js");
const { initProverStark,
    computeEvalsStark,
    computeFRIStark,
    genProofStark,
    setChallengesStark,
    calculateChallengeStark,
    extendAndMerkelize,
    getPermutationsStark,
    computeFRIFolding,
    computeFRIQueries,
    computeQStark,
    addTranscriptStark,
    getChallengeStark,
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const {
    calculatePublics,
    callCalculateExps,
    applyHints,
} = require("pil2-stark-js/src/prover/prover_helpers.js");

const pilInfo = require("pil2-stark-js/src/pil_info/pil_info.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const path = require("path");

const log = require('../../../logger.js');

class StarkFriProver extends ProverComponent {
    constructor(proofSharedMemory) {
        super("FRI Prover", proofSharedMemory);
    }

    initialize(settings, options) {
        super.initialize(settings, options);

        this.options.logger = log;

        const starkStructFilename =  path.join(__dirname, "../../..",  settings.starkStruct);
        this.starkStruct = require(starkStructFilename);
    }

    async setup(airCtx) {
        const subproofCtx = airCtx.subproofCtx;
        const airout = this.proofSharedMemory.getAirout();
        const airSymbols = airout.airout.symbols.filter(symbol => symbol.subproofId === subproofCtx.subproofId && symbol.airId === airCtx.airId);

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

    async newProof(airCtx, publics) {
        for (const airInstanceCtx of airCtx.subproofCtx.proofCtx.instances) {   
            airInstanceCtx.ctx = await initProverStark(airCtx.setup.starkInfo, airCtx.setup.fixedPols, airCtx.setup.constTree, this.options);                   
            airInstanceCtx.publics = publics;
        }
    }

    async verifyPil(subproofCtx, airId, instanceId, publics) {
        const pil1 = false;
        const stark = true;
        const debug = true;
        
        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[instanceId];
        const airout = this.proofSharedMemory.getAirout();
        const air = airout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);

        const starkInfo = pilInfo(subproofCtx.F, air, stark, pil1, debug, {});

        const verificationHashType = "GL";
        const splitLinearHash = false;
        const optionsPilVerify = {logger:log, debug, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};

        const setup = airInstanceCtx.airCtx.setup;
        
        return await starkGen(airInstanceCtx.wtnsPols, setup.fixedPols, {}, starkInfo, publics, optionsPilVerify);
    }

    async commitStage(stageId, proofCtx, airInstanceCtx) {
        this.checkInitialized();

        const airout = this.proofSharedMemory.getAirout();
        const ctx = airInstanceCtx.ctx;

        if (stageId === 1) {
            airInstanceCtx.wtnsPols.writeToBigBuffer(ctx.cm1_n, ctx.pilInfo.mapSectionsN.cm1);
            const airCtx = proofCtx.subproofsCtx[airInstanceCtx.subproofId].airsCtx[airInstanceCtx.airId];
            addTranscriptStark(ctx.transcript, [ctx.MH.root(airCtx.setup.constTree)]);
            this.calculatePublics(airInstanceCtx);
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

        let challenge;
        if(!this.options.debug) {
            let commits = stageId === airout.numStages + 1 ? await computeQStark(ctx, log) : await extendAndMerkelize(stageId, ctx, log);

            addTranscriptStark(ctx.transcript, commits);

            challenge = getChallengeStark(ctx.transcript);
        } else {
            challenge = ctx.F.random();
        }

        airInstanceCtx.ctx.challenges[stageId] = challenge;
    }

    async calculatePublics(airInstanceCtx) {
        const ctx = airInstanceCtx.ctx;
        
        calculatePublics(ctx, airInstanceCtx.publics);

        let publicsCommits = [];

        if (this.options.hashCommits) {
            const publicsRoot = await calculateHash(ctx, ctx.publics);
            publicsCommits.push(publicsRoot);
        } else {
            publicsCommits.push(...ctx.publics);
        }

        addTranscriptStark(ctx.transcript, publicsCommits);
    }

    async openingStage(openingId, proofCtx, airInstanceCtx) {
        this.checkInitialized();

        const isLastRound = openingId === 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length + 1;
        const numStages = this.proofSharedMemory.getAirout().numStages + 1;

        if(openingId === 1) {
            await this.computeOpenings(numStages + openingId, proofCtx, airInstanceCtx);
        } else if(openingId === 2) {
            await this.computeFRIStark(numStages + openingId, proofCtx, airInstanceCtx);
        } else if(openingId <= 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length) {
            await this.computeFRIFolding(numStages + openingId, proofCtx, airInstanceCtx, { step: openingId - 3});
        } else if(openingId === 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length + 1) {
            await this.computeFRIQueries(numStages + openingId, proofCtx, airInstanceCtx);
        } else {
            log.error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
            throw new Error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
        }


        return isLastRound ? PROVER_OPENINGS_COMPLETED : PROVER_OPENINGS_PENDING;
    }

    async computeAirChallenges(stageId, airInstanceCtx) {
        this.checkInitialized();

        airInstanceCtx.ctx.challenges[stageId] = await calculateChallengeStark(stageId, airInstanceCtx.ctx);
    }

    setChallenges(stageId, airInstanceCtx, challenge) {
        this.checkInitialized();

        setChallengesStark(stageId, airInstanceCtx.ctx, airInstanceCtx.ctx.transcript, challenge, log);
    }

    async computeOpenings(stageId, proofCtx, airInstance) {
        const ctx = airInstance.ctx;

        const subproofCtx = proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `Computing Openings for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const challenge = this.proofSharedMemory.getChallenge(stageId - 1);
        setChallengesStark(stageId, ctx, ctx.transcript, challenge, this.options);

        const evalCommits = await computeEvalsStark(ctx, this.options);

        addTranscriptStark(ctx.transcript, evalCommits);
        ctx.challenges[stageId] = getChallengeStark(ctx.transcript);
    }

    async computeFRIStark(stageId, proofCtx, airInstance) {
        const ctx = airInstance.ctx;

        const subproofCtx = proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `Computing FRI Stark for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const challenge = this.proofSharedMemory.getChallenge(stageId - 1);
        setChallengesStark(stageId, ctx, ctx.transcript, challenge, this.options);

        await computeFRIStark(ctx, this.options);

        ctx.challenges[stageId] = getChallengeStark(ctx.transcript);
    }

    async computeFRIFolding(stageId, proofCtx, airInstance, params) {
        const challenge = this.proofSharedMemory.getChallenge(stageId - 1);
        const ctx = airInstance.ctx;

        const subproofCtx = proofCtx.subproofsCtx[airInstance.subproofId];
        log.info(
            `[${this.name}]`,
            `Computing FRI Folding for subproof ${subproofCtx.name} airId ${airInstance.airId} instanceId ${airInstance.instanceId}`
        );

        const friCommits = await computeFRIFolding(params.step, ctx, challenge, this.options);

        addTranscriptStark(ctx.transcript, friCommits);
        ctx.challenges[stageId] = getChallengeStark(ctx.transcript);
    }

    async computeFRIQueries(stageId, proofCtx, airInstance, params) {
        const ctx = airInstance.ctx;

        const challenge = this.proofSharedMemory.getChallenge(stageId - 1);
    
        const friQueries = await getPermutationsStark(ctx, challenge);

        log.debug("··· FRI queries: [" + friQueries.join(",") + "]");
    
        computeFRIQueries(ctx, friQueries);

        proofCtx.instances[airInstance.instanceId].proof = await genProofStark(airInstance.ctx, log);
    }    

}

module.exports = StarkFriProver;