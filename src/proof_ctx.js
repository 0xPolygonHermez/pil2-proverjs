const log = require("../logger.js");

const { newCommitPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { addTranscriptStark, getChallengeStark } = require("pil2-stark-js/src/stark/stark_gen_helpers.js");
const { buildPoseidonGL, Transcript } = require("pil2-stark-js");

class ProofCtx {
    /**
     * Creates a new ProofCtx instance.
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
        this.subproofsCtx = [];
    }

    async initialize(publics) {
        //this.resetProofCtx(); 
        this.publics = publics;

        const poseidon = await buildPoseidonGL();
        this.transcript = new Transcript(poseidon);
    }

    addChallengeToTranscript(challenge) {
        addTranscriptStark(this.transcript, challenge);
    }

    computeGlobalChallenge(stageId) {
        if(this.challenges[stageId].length === 0) return;

        for(let i = 0; i< this.challenges[stageId].length; i++) {
            // this.challenges[stageId][i] = [0n, 0n, 0n];
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

    // Private methods
    addNewSubproof(subproofId, airout) {
        this.subproofsCtx[subproofId] = new SubproofCtx(airout, subproofId, this);

        return this.subproofsCtx[subproofId];
    }

    getAirout() {
        return this.airout;
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    addAirInstance(subproofId, airId) {
        const subproofCtx = this.subproofsCtx[subproofId];
        const airCtx = subproofCtx.airsCtx[airId];

        if (airCtx === undefined) return { result: false, data: undefined };

        const instanceId = this.numInstances++;
        const airInstance = new AirInstance(subproofId, airId, instanceId);
        this.instances[instanceId] = airInstance;

        const air = this.airout.getAirBySubproofIdAirId(subproofId, airId);
        const airSymbols = this.airout.getSymbolsBySubproofIdAirId(subproofId, airId);

        airInstance.wtnsPols = newCommitPolsArrayPil2(airSymbols, air.numRows, subproofCtx.F);

        return { result: true, airInstance};
    }   

    // Proof API
    getInstancesBySubproofIdAirId(subproofId, airId) {
        const instances = this.instances.filter(instance => instance.subproofId === subproofId && instance.airId === airId);
        return instances.sort((a, b) => a.instanceId - b.instanceId);
    }

    // getAirCols(subproofId, airId)
    //

    static createProofCtxFromAirout(name, airoutObj, finiteField) {
        const proofCtx = new ProofCtx(name, finiteField);
        proofCtx.airout = airoutObj;

        const airout = airoutObj.airout;
        for(let i = 0; i < airout.subproofs.length; i++) {
            proofCtx.addNewSubproof(i, airout);
        }

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

class SubproofCtx {
    /**
     * Creates a new SubproofCtxStruct instance.
     * @constructor
     * @param {number} subproofId - The subproofId property.
     * @param {string} name - The name property.
     * @param {AirInstance[]} airCtx - An array of air contexts.
     */
    constructor(airout, subproofId, proofCtx) {
        if(airout.subproofs[subproofId] === undefined) {
            log.error(`Subproof ${subproofId} not found in airout`);
            throw new Error(`Subproof ${subproofId} not found in airout`);
        }

        //this.F = proofCtx.F;

        //TODO remove this
        this.proofCtx = proofCtx;

        const subproof = airout.subproofs[subproofId];

        this.subproofId = subproofId;
        this.name = subproof.name;

        this.airsCtx = [];
        for (let i = 0; i < subproof.airs.length; i++) {
            const hasSubproofValue = subproof.subproofvalues !== undefined && subproof.subproofvalues[i] !== undefined;
            const airCtx = new AirCtx(i, this, subproof.airs[i], hasSubproofValue);
            this.airsCtx.push(airCtx);
        }
    }
}

class AirCtx {
    /**
     * @param {number} airId - The airId property.
     * @param {number} numRows - The number of rows in the AIR.
    */
    constructor(airId, subproofCtx, air, hasSubproofValue) {
        this.subproofId = subproofCtx.subproofId;
        this.airId = airId;
        this.name = air.name;
        this.layout = { numRows: air.numRows };
        
        this.subproofCtx = subproofCtx;
        this.hasSubproofValue = hasSubproofValue;

        this.setup;
    }
}

class AirInstance {
    constructor(subproofId, airId, instanceId) {
        this.subproofId = subproofId;
        this.airId = airId;
        this.instanceId = instanceId;

        this.proof = {};
    }
}

module.exports = ProofCtx;
