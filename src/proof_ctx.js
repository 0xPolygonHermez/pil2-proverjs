const log = require("../logger.js");

const { newCommitPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { addTranscriptStark, getChallengeStark } = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const { buildPoseidonGL, Transcript } = require("pil2-stark-js");

class ProofCtx {
    /**
     * Creates a new ProofCtx
     * @constructor
     */
    constructor(name, finiteField) {
        this.name = name;
        this.F = finiteField;

        this.resetProofCtx();
    }

    resetProofCtx() {
        this.publics = [];
        this.challenges = [];
        this.instances = [];
        this.numInstances = 0;
    }

    async initialize(publics) {
        this.publics = publics;

        const poseidon = await buildPoseidonGL();
        this.transcript = new Transcript(poseidon);

        this.instances = [];
    }

    addChallengeToTranscript(challenge) {
        addTranscriptStark(this.transcript, challenge);
    }

    computeGlobalChallenge(stageId) {
        if(this.challenges[stageId].length === 0) return;

        for(let i = 0; i< this.challenges[stageId].length; i++) {
            this.challenges[stageId][i] = getChallengeStark(this.transcript);
        }
    }

    getChallenge(stageId) {
        if (stageId >= this.challenges.length) {
            log.error(`The requested challenge is not within the valid bounds of proof challenges.`);
            throw new Error(`The requested challenge is not within the valid bounds of proof challenges.`);
        }

        return this.challenges[stageId];
    }

    getAirout() {
        return this.airout;
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    addAirInstance(subproofId, airId, numRows) {
        const air = this.airout.getAirBySubproofIdAirId(subproofId, airId);

        if (air === undefined) return { result: false, data: undefined };

        const instanceId = this.numInstances++;
        const layout = { numRows };
        const airInstance = new AirInstance(subproofId, airId, instanceId, layout);
        this.instances[instanceId] = airInstance;

        airInstance.wtnsPols = newCommitPolsArrayPil2(air.symbols, air.numRows, this.F);

        return { result: true, airInstance};
    }   

    // Proof API
    getInstancesBySubproofIdAirId(subproofId, airId) {
        const instances = this.instances.filter(instance => instance.subproofId === subproofId && instance.airId === airId);
        return instances.sort((a, b) => a.instanceId - b.instanceId);
    }

    // getAirCols(subproofId, airId)
    //

    static createProofCtxFromAirout(name, airout, finiteField) {
        const proofCtx = new ProofCtx(name, finiteField);
        proofCtx.airout = airout;

        if (airout.numChallenges !== undefined) {
            for (let i = 0; i < airout.numChallenges.length; i++) {
                if (airout.numChallenges[i] === undefined) continue;

                proofCtx.challenges.push(new Array(airout.numChallenges[i]).fill(null));
            }
        } else {
            proofCtx.challenges.push([]);
        }

        // qStage, evalsStage and friStage
        proofCtx.challenges.push(new Array(1).fill(null));
        proofCtx.challenges.push(new Array(1).fill(null));
        proofCtx.challenges.push(new Array(2).fill(null));
        
        // TODO: Calculate friStages
        proofCtx.challenges.push(new Array(1).fill(null));
        proofCtx.challenges.push(new Array(1).fill(null));
        proofCtx.challenges.push(new Array(1).fill(null));
        proofCtx.challenges.push(new Array(1).fill(null));
        

        return proofCtx;
    }
}

class AirInstance {
    constructor(subproofId, airId, instanceId, layout) {
        this.subproofId = subproofId;
        this.airId = airId;
        this.instanceId = instanceId;

        this.proof = {};
        this.layout = layout;
    }
}

module.exports = ProofCtx;
