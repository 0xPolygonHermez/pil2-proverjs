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
        this.subproofValues = [];
        this.challenges = [];
        this.stepsFRI = [];
        this.airInstances = [];
    }

    async initialize(publics, setup) {
        this.publics = publics;
        this.setup = setup;

        const poseidon = await buildPoseidonGL();
        this.transcript = new Transcript(poseidon);

        await this.initializeAirInstances();
    }

    async initializeAirInstances() {
        // Initialize the airInstances array
        this.airInstances = this.airout.subproofs.map((subproof) => subproof.airs.map(() => []));
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

    addAirInstance(subproofId, airInstance, numRows) {
        const airId = airInstance.airId;
        const air = this.airout.getAirBySubproofIdAirId(subproofId, airId);

        if (air === undefined) return { result: false, data: undefined };

        const instanceId = this.airInstances[subproofId][airId].length;
        const layout = { numRows };

        airInstance.instanceId = instanceId;
        airInstance.layout = layout;

        this.airInstances[subproofId][airId][instanceId] = airInstance;

        airInstance.wtnsPols = generateWtnsCols(air.symbols, air.numRows);

        return true;
    }   

    // Proof API
    getAirInstances() {
        return this.airInstances.flat(2);
    }

    getAirInstancesBySubproofId(subproofId) {
        return this.airInstances[subproofId].flat();
    }

    getAirInstancesBySubproofIdAirId(subproofId, airId) {
        const airInstances = this.airInstances[subproofId][airId];

        return airInstances;
    }

    // getAirCols(subproofId, airId)
    //

    static createProofCtxFromAirout(name, airout, airoutInfo, finiteField) {
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
        
        for(let i = 0; i < airoutInfo.stepsFRI.length + 1; ++i) {
            proofCtx.challenges.push(new Array(1).fill(null));
        }

        proofCtx.stepsFRI = airoutInfo.stepsFRI;
        
        for(let i = 0; i < airout.subproofs.length; i++) {
            proofCtx.subproofValues[i] = [];
            for(let j = 0; j < airout.subproofs[i].subproofvalues?.length; j++) {
                const aggType = airout.subproofs[i].subproofvalues[j].aggType;
                proofCtx.subproofValues[i][j] = aggType === 0 ? zero : one;
            }
        }

        return proofCtx;
    }
}

class AirInstance {
    constructor(subproofId, airId, instanceId, layout = {}) {
        this.subproofId = subproofId;
        this.airId = airId;
        this.instanceId = instanceId;
        this.proof = {};
        this.layout = layout;

        this.tmpPol = [];
    }
}

module.exports = {
    ProofCtx, AirInstance
};
