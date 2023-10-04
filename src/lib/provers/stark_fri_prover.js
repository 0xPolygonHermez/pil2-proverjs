const ProverComponent = require("../../prover.js");
const { PROVER_OPENING_TASKS_COMPLETED, PROVER_OPENING_TASKS_PENDING } = require("../../provers_manager.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup.js");
const starkGen = require("pil2-stark-js/src/stark/stark_gen.js");
const { initProverStark,
    computeEvalsStark,
    computeFRIStark,
    genProofStark,
    setChallengesStark,
    calculateChallengeStark,
    extendAndMerkelize,
    computeFRIChallenge,
    computeFRIFolding,
    computeFRIQueries,
    computeQStark
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const pilInfo = require("pil2-stark-js/src/pil_info/pil_info.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");

const path = require("path");

const log = require('../../../logger.js');

class StarkFriProver extends ProverComponent {
    constructor(proofmanagerAPI) {
        super("FRI Prover", proofmanagerAPI);
    }

    initialize(settings, options) {
        super.initialize(settings, options);

        const starkStructFilename =  path.join(__dirname, "../../..",  this.settings.starkStruct);
        this.starkStruct = require(starkStructFilename);
    }

    async setup(airCtx) {
        const subproofCtx = airCtx.subproofCtx;
        const pilout = this.proofmanagerAPI.getPilout().pilout;
        const airSymbols = pilout.symbols.filter(symbol => symbol.subproofId === subproofCtx.subproofId && symbol.airId === airCtx.airId);

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofCtx.subproofId, airCtx.airId);

        airCtx.setup = {
            name: (airCtx.name ? airCtx.name : airCtx.airId) + "-" + airCtx.numRows,
            cnstPols: newConstantPolsArrayPil2(airSymbols, airCtx.numRows, subproofCtx.F)
        };

        getFixedPolsPil2(air, airCtx.setup.cnstPols, subproofCtx.F);

        const options = {
            F: subproofCtx.F,
            pil1: false,
        };

        Object.assign(airCtx.setup, await starkSetup(airCtx.setup.cnstPols, air, this.starkStruct, options));
    }

    async newProof(airCtx) {
        for (const airInstanceCtx of airCtx.instances) {   
            airInstanceCtx.ctx = await initProverStark(airCtx.setup.starkInfo, airCtx.setup.cnstPols, airCtx.setup.constTree, { logger: log});                   
        }
    }

    async pilVerify(subproofCtx, airId, airInstanceId) {
        const pil1 = false;
        const stark = true;
        const debug = true;
        
        const airInstance = subproofCtx.airsCtx[airId].instances[airInstanceId];
        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);

        const starkInfo = pilInfo(subproofCtx.F, air, stark, pil1, debug, {});

        const verificationHashType = "GL";
        const splitLinearHash = false;
        const optionsPilVerify = {logger:log, debug, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};

        const setup = airInstance.airCtx.setup;
        return await starkGen(airInstance.cmmtPols, setup.cnstPols, {}, starkInfo, optionsPilVerify);
    }

    async commitStage(stageId, airInstanceCtx) {
        this.checkInitialized();

        const pilout = this.proofmanagerAPI.getPilout();
        
        if (stageId === pilout.numStages + 1)  {
            await computeQStark(airInstanceCtx.ctx, log);
        } else {
            await extendAndMerkelize(stageId, airInstanceCtx.ctx, log);
        }
    }

    async openingStage(openingId, airInstanceCtx) {
        this.checkInitialized();

        const isLastRound = openingId === 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length + 1;
        const numStages = this.proofmanagerAPI.getPilout().numStages + 1;

        if(openingId === 1) {
            await this.computeOpenings(numStages + openingId, airInstanceCtx);
        } else if(openingId === 2) {
            await this.computeFRIStark(numStages + openingId, airInstanceCtx);
        } else if(openingId <= 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length) {
            await this.computeFRIFolding(numStages + openingId, airInstanceCtx, { step: openingId - 3});
        } else if(openingId === 2 + airInstanceCtx.ctx.pilInfo.starkStruct.steps.length + 1) {
            await this.computeFRIQueries(numStages + openingId, airInstanceCtx);
        } else {
            log.error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
            throw new Error(`[${this.name}]`, `Invalid openingId ${openingId}.`);
        }


        return isLastRound ? PROVER_OPENING_TASKS_COMPLETED : PROVER_OPENING_TASKS_PENDING;
    }

    async computeAirChallenges(stageId, airInstanceCtx) {
        this.checkInitialized();

        airInstanceCtx.ctx.challenges[stageId] = await calculateChallengeStark(stageId, airInstanceCtx.ctx);
    }

    setChallenges(stageId, airInstanceCtx, challenge) {
        this.checkInitialized();

        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);
    }

    async computeOpenings(stageId, airInstanceCtx) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        log.info(`[${this.name}]`, `Computing Openings for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const challenge = this.proofmanagerAPI.getChallenge(stageId - 1);
        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);

        await computeEvalsStark(airInstanceCtx.ctx, log);

        airInstanceCtx.ctx.challenges[stageId] = await calculateChallengeStark(stageId, airInstanceCtx.ctx);
    }

    async computeFRIStark(stageId, airInstanceCtx, params) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        log.info(`[${this.name}]`, `Computing FRI Stark for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const options = { parallelExec: false, useThreads: false, logger: log };

        const challenge = this.proofmanagerAPI.getChallenge(stageId - 1);
        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);

        await computeFRIStark(airInstanceCtx.ctx, options);

        airInstanceCtx.ctx.challenges[stageId] = computeFRIChallenge(stageId - 4, airInstanceCtx.ctx, log);
    }

    async computeFRIFolding(stageId, airInstanceCtx, params) {
        const challenge = this.proofmanagerAPI.getChallenge(stageId - 1);

        await computeFRIFolding(params.step, airInstanceCtx.ctx, challenge);

        airInstanceCtx.ctx.challenges[stageId] = computeFRIChallenge(stageId - 4, airInstanceCtx.ctx, log);
    }

    async computeFRIQueries(stageId, airInstanceCtx, params) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        const challenge = this.proofmanagerAPI.getChallenge(stageId - 1);
    
        computeFRIQueries(airInstanceCtx.ctx, challenge);

        subproofCtx.airsCtx[airId].instances[airInstanceId].proof = await genProofStark(airInstanceCtx.ctx, log);
    }    

}

module.exports = StarkFriProver;