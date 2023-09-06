const ProverComponent = require("../../prover.js");
const log = require('../../../logger.js');
const { generateStarkProof } = require("../../../node_modules/pil2-stark-js/test/stark/helpers.js");
const path = require("path");
class ProverFri extends ProverComponent {
    constructor(proofmanagerAPI) {
        super("FRI Prover", proofmanagerAPI);
    }

    initialize(settings) {
        super.initialize(settings);
    }

    commitStage(stageId, subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        this.checkInitialized();
    }

    getProverCallbacks() {
        this.checkInitialized();

        return [
            this.generateStarkProof.bind(this)
        ];

        return [
            this.computeQ.bind(this),
            this.computeOpenings.bind(this),
            this.FRICommitPhase.bind(this),
            this.FRIQueryPhase.bind(this),
        ];
    }

    async generateStarkProof(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Generating STARK proof for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);

        const airInstance = subproofCtx.airsCtx[airId].instances[airInstanceId];

        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofId, airId);
        //TODO: change
        air.symbols = pilout.pilout.symbols;
        log.debug = log.info;

        const starkStructFilename =  path.join(require.main.path, this.settings.starkStruct);
        const starkStruct = require(starkStructFilename);
        await generateStarkProof(airInstance.constPols, airInstance.cmPols, air, starkStruct, {logger: log, F: proofCtx.F, pil1: false, skip: true});
    }

    computeQ(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing Q for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);
    }

    computeOpenings(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing Openings for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);
    }

    FRICommitPhase(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing FRI Commit Phase for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);
    }

    FRIQueryPhase(subproofId, airId, airInstanceId, proofCtx, subproofCtx) {
        log.info(`[${this.name}]`, `Computing FRI Query Phase for subproof ${subproofCtx.name} airId ${airId} airInstanceId ${airInstanceId}`);
    }
}

module.exports = ProverFri;