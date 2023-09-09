const log = require("../logger.js");
const F3g = require("../node_modules/pil2-stark-js/src/helpers/f3g");
const { getRoots } = require("../node_modules/pilcom/src/utils.js");

class ProofCtxStruct {
    /**
     * Creates a new GlobalCtxStruct instance.
     * @constructor
     * @param {string} name - The name property.
     * @param {FiniteField} F - A finite field class.
     * @param {int} blowupFactor - The blowup factor, determining the multiplication factor applied to the base field's size for enhanced security
     * @param {BaseFieldElement[]} challenges - An array of proof challenges.
     */
    constructor(pilout) {
        this.name = pilout.name;

        if(pilout.baseField.equals(Buffer.from("FFFFFFFF00000001", "hex"))) {
            this.F = new F3g("0xFFFFFFFF00000001");
            this.F.w = getRoots(this.F);
        } else {
            throw new Error(`Finite field with this characteristic prime number ${"0x" + pilout.baseField.toString('hex').toUpperCase()} not supported`);
        }

        this.blowupFactor = pilout.blowupFactor;
        this.challenges = [];
        if (pilout.numChallenges !== undefined) {
            for (let i = 0; i < pilout.numChallenges.length; i++) {
                if (pilout.numChallenges[i] === undefined) continue;

                this.challenges.push(
                    new Array(pilout.numChallenges[i]).fill(null)
                );
            }
        }
        // this.publicTables = []; ???? Should be added here?
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
    constructor(pilout, subproofId, proofCtx) {
        if(pilout.subproofs[subproofId] === undefined) {
            log.error(`Subproof ${subproofId} not found in pilout`);
            throw new Error(`Subproof ${subproofId} not found in pilout`);
        }
        this.proofCtx = proofCtx;

        const subproof = pilout.subproofs[subproofId];

        this.subproofId = subproofId;
        this.name = subproof.name;

        this.blowupFactor = pilout.blowupFactor;
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
        this.subproofCtx = subproofCtx;
        this.numRows = air.numRows;
        this.hasSubproofValue = hasSubproofValue;
        this.instances = [];

        // FIXME change it when available, mocked!!!!!
        this.nPolsBaseField = 2;
        this.nPolsExtension = 1;
    }

    addAirInstance(airId, numRows) {
        // const F = this.subproofCtx.proofCtx.F;
        // const sizeOneRowBytes = (this.nPolsBaseField + this.nPolsExtension * this.subproofCtx.blowupFactor) * F.n8;

        // const buffer = new Uint8Array(sizeOneRowBytes * numRows, { maxByteLength: sizeOneRowBytes * numRows});
        // const offset = sizeOneRowBytes;

        const airInstance = new AirInstanceCtxStruct(this, airId, numRows);
        this.instances.push(airInstance);

        return airInstance;
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
        this.numRows = numRows;
        this.proof = {};
        if(airCtx.hasSubproofValue)  this.subproofValue = null;
    }
}

function proofContextFromPilout(piloutObj) {
    const pilout = piloutObj.pilout;
    const proofCtx = new ProofCtxStruct(pilout);
    const subproofsCtx = [];
    for(let i = 0; i < pilout.subproofs.length; i++) {
        subproofsCtx[i] = new SubproofCtxStruct(pilout, i, proofCtx);
    }

    return { proofCtx, subproofsCtx };
}

module.exports = proofContextFromPilout;
