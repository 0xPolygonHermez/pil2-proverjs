class ProofManagerAPI {
    constructor(proofManager) {
        this.proofManager = proofManager;
    }

    getName() {
        return proofManager.getName();
    }

    getPilout() {
        return this.proofManager.pilout;
    }

    // Allocate a new buffer for the given subproof and air with the given numRows.
    allocateNewBuffer(subproofId, airId, numRows, nPolsBaseField, nPolsExtension) {
        return this.proofManager.allocateNewBuffer(subproofId, airId, numRows, nPolsBaseField, nPolsExtension);
    }

    // Reallocate the buffer for the given subproof and air with the given numRows.
    reallocateBuffer(subproofId, airId, idx, numRows) {
        return this.proofManager.reallocateBuffer(subproofId, airId, idx, numRows);
    }

    // Free the buffer for the given subproof and air.
    freeBuffer(subproofId, airId) {
        return this.proofManager.freeBuffer(subproofId, airId);
    }
}

module.exports = ProofManagerAPI;
