class ProofCtxStruct {
    /**
     * Creates a new GlobalCtxStruct instance.
     * @constructor
     * @param {string} name - The name property.
     * @param {FiniteFieldOperator} F - A finite field class.
     * @param {int} blowupFactor - The blowup factor, so the factor by which the size of the base field is multuplied to give security.
     * @param {BaseFieldElement[]} challenges - Proof challenges
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
        // this.publicTables = []; ???? Can we add it here?
    }
}

class SubproofCtxStruct {
    constructor(pilout, subproofId) {
        const subproof = pilout.subproofs[subproofId];

        this.subproofId = subproofId;
        this.name = subproof.name;
        this.airsCtx = [];
        for (let i = 0; i < subproof.airs.length; i++) {
            let airCtx = {
                airId: i,
                defaultNumRows: subproof.airs[i].numRows,
                // FIXME change it when available, mocked!!!!!
                nPolsBaseField: 2,
                nPolsExtension: 1,
                instances: [],
            }
            if (subproof.subproofvalues !== undefined &&
                subproof.subproofvalues[i] !== undefined) {
                airCtx.subproofValue = null;
            }

            this.airsCtx.push(airCtx);
        }
    }

    addAirInstance(airId, numRows, buffer, offset) {
        const airInstance = new AirCtxStruct(this, airId, numRows, buffer, offset);
        this.airsCtx[airId].instances.push(airInstance);
        return airInstance;
    }
}

class AirCtxStruct {
    constructor(subproofCtx, airId, numRows, buffer, offset) {
        this.airId = airId;
        this.instanceId = subproofCtx.airsCtx[airId].instances.length;
        this.numRows = numRows;
        this.buffer = buffer ?? [];
        this.offset = offset ?? 0;
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
