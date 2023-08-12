class GlobalCtxStruct {
    constructor(pilout) {
        this.name = pilout.name;
        // TODO change it, mocked!!!!!
        this.F = {};
        this.F.n8 = 32;
        
        //this.baseField = baseField;
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

function createProofContexts(pilout) {
    const proofCtx = new GlobalCtxStruct(pilout.pilout);
    const subproofsCtx = [];
    pilout.pilout.subproofs.forEach((subproof, index) => {
        subproofsCtx[index] = new SubproofCtxStruct(subproof);
    });

    return { proofCtx, subproofsCtx };
}

module.exports = createProofContexts;
