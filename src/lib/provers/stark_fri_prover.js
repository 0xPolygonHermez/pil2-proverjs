const ProverComponent = require("../../prover.js");
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

    async pilVerify(subproofCtx, airId, airInstanceId) {
        const pil1 = false;
        const stark = true;
        const debug = true;

        log.debug = log.info;
        const airInstance = subproofCtx.airsCtx[airId].instances[airInstanceId];
        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);
        air.hints = pilout.pilout.hints;
        air.numChallenges = pilout.pilout.numChallenges;
        air.symbols = pilout.pilout.symbols;

        const starkInfo = pilInfo(subproofCtx.F, air, stark, pil1, debug, {});

        const verificationHashType = "GL";
        const splitLinearHash = false;
        const optionsPilVerify = {logger:log, debug, useThreads: false, parallelExec: false, verificationHashType, splitLinearHash};

        return await starkGen(airInstance.cmmtPols, airInstance.cnstPols, {}, starkInfo, optionsPilVerify);
    }

    async setupProof(subproofCtx, airId, airInstanceId) {
        const airInstance = subproofCtx.airsCtx[airId].instances[airInstanceId];
        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);

        log.debug = log.info;

        const options = {
            F: subproofCtx.F,
            pil1: false,
            parallelExec: false,
            useThreads: false,
            logger: log,
        };
    
        airInstance.setup = await starkSetup(airInstance.cnstPols, air, this.starkStruct, options);
    
        airInstance.ctx = await initProverStark(airInstance.setup.starkInfo, airInstance.cnstPols, airInstance.setup.constTree, options);
        
        // Read committed polynomials
        airInstance.cmmtPols.writeToBigBuffer(airInstance.ctx.cm1_n, airInstance.ctx.pilInfo.mapSectionsN.cm1);
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

    async computeAirChallenges(stageId, airInstanceCtx) {
        this.checkInitialized();

        airInstanceCtx.ctx.challenges[stageId] = await calculateChallengeStark(stageId, airInstanceCtx.ctx);
    }

    setChallenges(stageId, airInstanceCtx, challenge) {
        this.checkInitialized();

        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);
    }

    getProverCallbacks(airInstanceCtx) {
        this.checkInitialized();

        let callbacks = [
            { callback: this.computeOpenings.bind(this), airInstanceCtx, params: {}},
            { callback: this.computeFRIStark.bind(this), airInstanceCtx, params: {} },
        ];

        for (let step = 0; step < airInstanceCtx.ctx.pilInfo.starkStruct.steps.length; step++) {
            const callbackItem = {
                callback: this.computeFRIFolding.bind(this),
                airInstanceCtx,
                params: { step }
            }
            callbacks.push(callbackItem);
        }

        callbacks.push({ callback: this.computeFRIQueries.bind(this), airInstanceCtx, params: {}});

        return callbacks;
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