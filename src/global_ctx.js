class GlobalCtxStruct {
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

        // TODO change it when available, mocked!!!!!
        this.blowupFactor = 3; //pilout.blowupFactor;
        this.challenges = [];
        // this.publicTables = []; ???? Can we add it here?
    }
}

class SubproofCtxStruct {
    constructor(subproof) {
        this.name = subproof.name;

        this.airs = [];
    }
}

function proofContextsFromPilout(pilout) {
    const proofCtx = new GlobalCtxStruct(pilout.pilout);
    const subproofsCtx = [];
    pilout.pilout.subproofs.forEach((subproof, index) => {
        subproofsCtx[index] = new SubproofCtxStruct(subproof);
    });

    return { proofCtx, subproofsCtx };
}

module.exports = proofContextsFromPilout;
