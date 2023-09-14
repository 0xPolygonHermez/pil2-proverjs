const ProverComponent = require("../../prover.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup.js");
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

const path = require("path");

const log = require('../../../logger.js');

class StarkFriProver extends ProverComponent {
    constructor(proofmanagerAPI) {
        super("FRI Prover", proofmanagerAPI);
    }

    initialize(settings) {
        super.initialize(settings);

        const starkStructFilename =  path.join(__dirname, "../../..",  this.settings.starkStruct);
        this.starkStruct = require(starkStructFilename);
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
            useThreads: false
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

    async computeChallenges(stageId, airInstanceCtx) {
        this.checkInitialized();

        if(stageId >= 7) {
            return computeFRIChallenge(airInstanceCtx.ctx.pilInfo.starkStruct.steps.length, airInstanceCtx.ctx, log);
        } else if(stageId >= 4) {
            return computeFRIChallenge(stageId-4, airInstanceCtx.ctx, log);
        } else {
            return await calculateChallengeStark(stageId, airInstanceCtx.ctx);
        }

    }

    setChallenges(stageId, airInstanceCtx, challenge) {
        this.checkInitialized();

        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);
    }

    getProverCallbacksNew(airInstanceCtx) {
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

        await computeEvalsStark(airInstanceCtx.ctx, log);
    }

    async computeFRIStark(stageId, airInstanceCtx, params) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        log.info(`[${this.name}]`, `Computing FRI Stark for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const options = { parallelExec: false, useThreads: false, logger: log };

        await computeFRIStark(airInstanceCtx.ctx, options);
    }

    async computeFRIFolding(stageId, airInstanceCtx, params) {
        const challenge = this.proofmanagerAPI.getChallenge(stageId - 1);

        await computeFRIFolding(params.step, airInstanceCtx.ctx, challenge);
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