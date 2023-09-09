class ProofManagerAPI {
    constructor(proofManager) {
        this.proofManager = proofManager;
    }

    getPilout() {
        return this.proofManager.pilout;
    }

    // Allocate a new buffer for the given subproof and air with the given numRows.
    addAirInstance(subproofId, airId, numRows) {
        return this.proofManager.addAirInstance(subproofId, airId, numRows);
    }

    // Reallocate the buffer for the given subproof and air with the given numRows.
    resizeAirInstance(subproofId, airId, idx, numRows) {
        return this.proofManager.resizeAirInstance(subproofId, airId, idx, numRows);
    }

    // Free the buffer for the given subproof and air.
    removeAirInstance(subproofId, airId) {
        return this.proofManager.resizeAirInstance(subproofId, airId);
    }
}

module.exports = ProofManagerAPI;
