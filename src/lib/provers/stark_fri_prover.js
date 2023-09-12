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

        return await calculateChallengeStark(stageId, airInstanceCtx.ctx);
    }

    setChallenges(stageId, airInstanceCtx, challenge) {
        this.checkInitialized();

        setChallengesStark(stageId, airInstanceCtx.ctx, challenge, log);
    }

    getProverCallbacks() {
        this.checkInitialized();

        return [
            this.computeOpenings.bind(this),
            this.computeFRI.bind(this),
            
        ];
    }

    async computeOpenings(stageId, airInstanceCtx) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        log.info(`[${this.name}]`, `Computing Openings for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        let challenge = this.proofmanagerAPI.getChallenge(stageId + 2);

        await computeEvalsStark(airInstanceCtx.ctx, challenge, log);
    }

    async computeFRI(stageId, airInstanceCtx) {
        const airId = airInstanceCtx.airId;
        const airInstanceId = airInstanceCtx.instanceId;
        const subproofCtx = airInstanceCtx.airCtx.subproofCtx;

        log.info(`[${this.name}]`, `Computing FRI for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const options = { parallelExec: false, useThreads: false, logger: log };

        await computeFRIStark(airInstanceCtx.ctx, options);

        for (let step = 0; step < airInstanceCtx.ctx.pilInfo.starkStruct.steps.length; step++) {
            const challenge = computeFRIChallenge(step, airInstanceCtx.ctx, log);

            await computeFRIFolding(step, airInstanceCtx.ctx, challenge);
        }
    
        const friQueries = computeFRIChallenge(airInstanceCtx.ctx.pilInfo.starkStruct.steps.length, airInstanceCtx.ctx, log);
    
        computeFRIQueries(airInstanceCtx.ctx, friQueries);

        subproofCtx.airsCtx[airId].instances[airInstanceId].proof = await genProofStark(airInstanceCtx.ctx, log);
    }    
}

module.exports = StarkFriProver;