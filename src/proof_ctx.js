const log = require("../logger.js");
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { getRoots } = require("pilcom/src/utils.js");

class ProofCtxStruct {
    /**
     * Creates a new ProofCtxStruct instance.
     * @constructor
     * @param {airout} airout - The airout proto.
     */
    constructor(airout) {
        this.name = airout.name;

        if(airout.baseField.equals(Buffer.from("FFFFFFFF00000001", "hex"))) {
            this.F = new F3g("0xFFFFFFFF00000001");
            this.F.w = getRoots(this.F);
        } else {
            throw new Error(`Finite field with this characteristic prime number ${"0x" + airout.baseField.toString('hex').toUpperCase()} not supported`);
        }

        this.challenges = [];
        if (airout.numChallenges !== undefined) {
            for (let i = 0; i < airout.numChallenges.length; i++) {
                if (airout.numChallenges[i] === undefined) continue;

                this.challenges.push(new Array(airout.numChallenges[i]).fill(null));
            }
        }
        // this.publicTables = []; ???? Should be added here?
    }

    setChallenge(stageId, challenge) {
        // if (stageId >= this.challenges.length) {
        //     log.error(`The requested challenge is not within the valid bounds of proof challenges.`);
        //     throw new Error(`The requested challenge is not within the valid bounds of proof challenges.`);
        // }

        this.challenges[stageId] = challenge;
    }

    getChallenge(stageId) {
        if (stageId >= this.challenges.length) {
            log.error(`The requested challenge is not within the valid bounds of proof challenges.`);
            throw new Error(`The requested challenge is not within the valid bounds of proof challenges.`);
        }

        return this.challenges[stageId];
    }

    areChallengesDefined(stageId) {
        if (stageId > this.challenges.length) return false;

        for(let i = 0; i < this.challenges[stageId].length; i++) {
            if (this.challenges[stageId][i] === null) return false;
        }

        return true;
    }
}

class SubproofCtxStruct {
    /**
     * Creates a new SubproofCtxStruct instance.
     * @constructor
     * @param {number} subproofId - The subproofId property.
     * @param {string} name - The name property.
     * @param {AirInstanceCtxStruct[]} airCtx - An array of air contexts.
     */
    constructor(airout, subproofId, proofCtx) {
        if(airout.subproofs[subproofId] === undefined) {
            log.error(`Subproof ${subproofId} not found in airout`);
            throw new Error(`Subproof ${subproofId} not found in airout`);
        }

        this.F = proofCtx.F;

        this.subproofId = subproofId;

        const subproof = airout.subproofs[subproofId];
        this.name = subproof.name;

        this.airsCtx = [];
        for (let i = 0; i < subproof.airs.length; i++) {
            const hasSubproofValue = subproof.subproofvalues !== undefined && subproof.subproofvalues[i] !== undefined;
            const airCtx = new AirCtxStruct(i, this, subproof.airs[i], hasSubproofValue);
            this.airsCtx.push(airCtx);
        }
    }

    addAirInstance(airId, numRows) {
        return this.airsCtx[airId].addAirInstance(airId, numRows);
    }
}

class AirCtxStruct {
    /**
     * @param {number} airId - The airId property.
     * @param {number} numRows - The number of rows in the AIR.
    */
    constructor(airId, subproofCtx, air, hasSubproofValue) {
        this.airId = airId;
        this.name = air.name;
        // Pointer to subproofCtx
        this.subproofCtx = subproofCtx;
        this.numRows = air.numRows;
        this.hasSubproofValue = hasSubproofValue;
        this.instances = [];
    }

    addAirInstance(airId, numRows) {
        const airInstanceCtx = new AirInstanceCtxStruct(this, airId, numRows);
        this.instances.push(airInstanceCtx);

        return airInstanceCtx;
    }

}

class AirInstanceCtxStruct {
    /**
     * @param {number} airId - The airId property.
     * @param {number} numRows - The number of rows in the AIR.
     * @param {*} buffer
     * @param {*} offset
     */
    constructor(airCtx, airId, numRows) {
        this.airId = airId;
        this.instanceId = airCtx.instances.length;
        // Pointer to airCtx
        this.airCtx = airCtx;
        this.publics = {};
        this.proof = {};
        if(airCtx.hasSubproofValue)  this.subproofValue = null;
    }
}

function proofContextFromAirout(airoutObj) {
    const airout = airoutObj.airout;
    const proofCtx = new ProofCtxStruct(airout);
    const subproofsCtx = [];
    for(let i = 0; i < airout.subproofs.length; i++) {
        subproofsCtx[i] = new SubproofCtxStruct(airout, i, proofCtx);
    }

    return { proofCtx, subproofsCtx };
}

module.exports = proofContextFromAirout;
