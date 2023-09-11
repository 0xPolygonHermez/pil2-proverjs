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
    computeFRIQueries
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");

const path = require("path");

const log = require('../../../logger.js');

class ProverFri extends ProverComponent {
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
            F: subproofCtx.proofCtx.F,
            pil1: false,
            parallelExec: false,
            useThreads: false
        };
    
        airInstance.setup = await starkSetup(airInstance.cnstPols, air, this.starkStruct, options);
    
        airInstance.ctx = await initProverStark(airInstance.setup.starkInfo, airInstance.cnstPols, airInstance.setup.constTree, options);
        
        // Read committed polynomials
        airInstance.cmmtPols.writeToBigBuffer(airInstance.ctx.cm1_n, airInstance.ctx.pilInfo.mapSectionsN.cm1);
    }

    async commitStage(stageId, subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;
        await extendAndMerkelize(stageId, airInstanceCtx, log);
    }

    async computeChallenges(stageId, airId, airInstanceId, subproofCtx) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `··· Computing challenges for stage ${stageId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        return await calculateChallengeStark(stageId, airInstanceCtx);
    }

    setChallenges(stageId, airId, airInstanceId, challenge, subproofCtx) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `··· Setting challenges for stage ${stageId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        setChallengesStark(stageId, airInstanceCtx, challenge, log);
    }

    getProverCallbacks() {
        this.checkInitialized();

        return [
            this.computeOpenings.bind(this),
            this.computeFRI.bind(this),
            
        ];
    }

    async computeOpenings(stageId, subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing Openings for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        let challenge = proofCtx.challenges[stageId + 2];

        await computeEvalsStark(airInstanceCtx, challenge, log);
    }

    async computeFRI(stageId, subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing FRI for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        const options = { parallelExec: false, useThreads: false, logger: log };

        await computeFRIStark(airInstanceCtx, options);

        let challenge;
        for (let step = 0; step < airInstanceCtx.pilInfo.starkStruct.steps.length; step++) {

            challenge = computeFRIChallenge(step, airInstanceCtx, log);
            await computeFRIFolding(step, airInstanceCtx, challenge);
        }
    
        const friQueries = computeFRIChallenge(airInstanceCtx.pilInfo.starkStruct.steps.length, airInstanceCtx, log);
    
        computeFRIQueries(airInstanceCtx, friQueries);

        subproofCtx.airsCtx[airId].instances[airInstanceId].proof = await genProofStark(airInstanceCtx, log);
    }    
}

module.exports = ProverFri;