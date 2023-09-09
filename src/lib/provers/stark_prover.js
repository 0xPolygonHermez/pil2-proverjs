const ProverComponent = require("../../prover.js");
const log = require('../../../logger.js');
const { initProverStark,
    computeEvalsStark,
    computeFRIStark,
    computeFRIProof,
    genProofStark,
    setChallengesStark,
    calculateChallengeStark,
    computeQStark
} = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const { callCalculateExps } = require("pil2-stark-js/src/prover/prover_helpers.js");
const { extendAndMerkelize } = require("pil2-stark-js/src/stark/stark_gen_helpers.js");

const starkSetup = require("pil2-stark-js/src/stark/stark_setup.js");
const path = require("path");

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
    
        airInstance.setup = await starkSetup(airInstance.constPols, air, this.starkStruct, options);
    
        airInstance.ctx = await initProverStark(airInstance.setup.starkInfo, airInstance.constPols, airInstance.setup.constTree, options);
        
        // Read committed polynomials
        airInstance.cmPols.writeToBigBuffer(airInstance.ctx.cm1_n, airInstance.ctx.pilInfo.mapSectionsN.cm1);
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

        return [/*this.computeQ.bind(this),*/ this.computeOpenings.bind(this), this.computeFRI.bind(this) ];
    }

    async computeQ(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing Q for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;
        let challenge = proofCtx.challenges[airInstanceCtx.pilInfo.nLibStages];
            
        // Compute challenge a
        const qStage = airInstanceCtx.pilInfo.nLibStages + 2;
        setChallengesStark(qStage, airInstanceCtx, challenge, log);
        
        // STEP 4.2 - Compute stage 4 polynomial --> Q polynomial
        await callCalculateExps("Q", "ext", airInstanceCtx, this.settings.parallelExec, this.settings.useThreads);
    
        await computeQStark(airInstanceCtx, log);
    }

    async computeOpenings(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing Openings for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        setChallengesStark(
            airInstanceCtx.pilInfo.numChallenges.length + 2,
            airInstanceCtx,
            proofCtx.challenges[ airInstanceCtx.pilInfo.numChallenges.length ],
            log);

        let challenge = proofCtx.challenges[airInstanceCtx.pilInfo.numChallenges.length + 2];

        await computeEvalsStark(airInstanceCtx, challenge, log);
    }

    async computeFRI(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing FRI for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[airInstanceId].ctx;

        setChallengesStark(
            airInstanceCtx.pilInfo.numChallenges.length + 3,
            airInstanceCtx,
            proofCtx.challenges[ airInstanceCtx.pilInfo.numChallenges.length + 1 ],
            log);

        const options = { parallelExec: false, useThreads: false, logger: log };

        await computeFRIStark(airInstanceCtx, options);
        
        await computeFRIProof(airInstanceCtx);

        subproofCtx.airsCtx[airId].instances[airInstanceId].proof = await genProofStark(airInstanceCtx, log);
    }    
}

module.exports = ProverFri;