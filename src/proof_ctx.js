const log = require("../logger.js");

const { generateWtnsCols } = require("pil2-stark-js/src/witness/witnessCalculator.js");
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
        this.subAirValues = [];
        this.challenges = [];
        this.stepsFRI = [];
        this.airInstances = [];
        this.numInstances = 0;
    }

    async initialize(publics) {
        this.publics = publics;

        const poseidon = await buildPoseidonGL();
        this.transcript = new Transcript(poseidon);

        this.airInstances = [];
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
        this.airInstances[instanceId] = airInstance;

        airInstance.wtnsPols = generateWtnsCols(1, air.symbols, air.numRows);

        return { result: true, airInstance};
    }   

    // Proof API
    getAirInstancesBySubproofIdAirId(subproofId, airId) {
        const airInstances = this.airInstances.filter(airInstance => airInstance.subproofId === subproofId && airInstance.airId === airId);

        return airInstances.sort((a, b) => a.instanceId - b.instanceId);
    }

    // getAirCols(subproofId, airId)
    //

    static createProofCtxFromAirout(name, airout, stepsFRI, finiteField) {
        const proofCtx = new ProofCtx(name, finiteField);
        proofCtx.airout = airout;

        const zero = finiteField.zero;
        const one = finiteField.one;

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
        
        for(let i = 0; i < stepsFRI.length + 1; ++i) {
            proofCtx.challenges.push(new Array(1).fill(null));
        }

        proofCtx.stepsFRI = stepsFRI;
        
        for(let i = 0; i < airout.subproofs.length; i++) {
            proofCtx.subAirValues[i] = [];
            for(let j = 0; j < airout.subproofs[i].subproofvalues?.length; j++) {
                const aggType = airout.subproofs[i].subproofvalues[j].aggType;
                proofCtx.subAirValues[i][j] = aggType === 0 ? zero : one;
            }
        }
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

        this.tmpPol = [];
    }
}

module.exports = ProofCtx;
