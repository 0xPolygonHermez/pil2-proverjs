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
        // TODO change it, mocked!!!!!
        //this.baseField = baseField;
        this.F = {};
        this.F.n8 = 32;

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
}

class SubproofCtxStruct {
    /**
     * Creates a new SubproofCtxStruct instance.
     * @constructor
     * @param {number} subproofId - The subproofId property.
     * @param {string} name - The name property.
     * @param {AirInstanceCtxStruct[]} airCtx - An array of air contexts.
     */
    constructor(pilout, subproofId) {
        const subproof = pilout.subproofs[subproofId];

        this.subproofId = subproofId;
        this.name = subproof.name;
        this.airsCtx = [];
        for (let i = 0; i < subproof.airs.length; i++) {
            const hasSubproofValue =
                subproof.subproofvalues !== undefined &&
                subproof.subproofvalues[i] !== undefined;
            const airCtx = new AirCtxStruct(i, subproof.airs[i].numRows, hasSubproofValue);
            this.airsCtx.push(airCtx);
        }

    }

    addAirInstance(airId, numRows, buffer, offset) {
        return this.airsCtx[airId].addAirInstance(airId, numRows, buffer, offset);
    }
}

class AirCtxStruct {
    /**
     * @param {number} airId - The airId property.
     * @param {number} numRows - The number of rows in the AIR.
    */
    constructor(airId, numRows, hasSubproofValue) {
        this.airId = airId;
        this.numRows = numRows;
        this.instances = [];
        this.subproofValue = null;

        // FIXME change it when available, mocked!!!!!
        this.nPolsBaseField = 2;
        this.nPolsExtension = 1;

        this.polMap = [];
        this.polCtx = {};
    }

    addAirInstance(airId, numRows, buffer, offset) {
        const airInstance = new AirInstanceCtxStruct(this, airId, numRows, buffer, offset);
        this.instances.push(airInstance);
        return airInstance;
    }

    addPolMap(name, stage, dim, relPos, genPos, dom) {
        const polMap = new PolMapStruct(name, stage, dim, relPos, genPos, dom);
        this.polMap.push(polMap);
        return polMap;
    }

    addPolCtx(owner, polName, polMapPos) {
        if (this.polCtx[owner] === undefined) this.polCtx[owner] = { pols: [] };

        this.polCtx.pols.push(new LibCtxStruct(polName, polMapPos));
    }
}

class AirInstanceCtxStruct {
    /**
     * @param {number} airId - The airId property.
     * @param {number} numRows - The number of rows in the AIR.
     * @param {*} buffer
     * @param {*} offset
     */
    constructor(airCtx, airId, numRows, buffer, offset) {
        this.airId = airId;
        this.instanceId = airCtx.instances.length;
        this.numRows = numRows;
        this.buffer = buffer ?? [];
        // this.polMap = {};//
        // this.libCtx...
        this.offset = offset ?? 0;
    }
}

class PolMapStruct {
    constructor(name, stage, dim, relPos, genPos, dom) {
        this.name = name;
        this.stage = stage;
        this.dim = dim;
        this.relPos = relPos;
        this.genPos = genPos;
        this.dom = dom;
    }
}

class LibCtxStruct {
    constructor(name, polMapPos) {
        this.name = name;
        this.polMapPos = polMapPos;
    }
}

function proofContextFromPilout(piloutObj) {
    const pilout = piloutObj.pilout;
    const proofCtx = new ProofCtxStruct(pilout);
    const subproofsCtx = [];
    for(let i = 0; i < pilout.subproofs.length; i++) {
        subproofsCtx[i] = new SubproofCtxStruct(pilout, i);
    }

    return { proofCtx, subproofsCtx };
}

module.exports = proofContextFromPilout;
