class ProofManagerAPI {
    constructor(proofOrchestrator) {
        this.proofOrchestrator = proofOrchestrator;
    }

    getAirout() {
        return this.proofOrchestrator.airout;
    }

    setChallenge(stageId, challenge) {
        return this.proofOrchestrator.proofCtx.setChallenge(stageId, challenge);
    }

    getChallenge(stageId) {
        return this.proofOrchestrator.proofCtx.challenges[stageId];
    }

    // Allocate a new buffer for the given subproof and air with the given numRows.
    addAirInstance(subproofId, airId, numRows) {
        return this.proofOrchestrator.addAirInstance(subproofId, airId, numRows);
    }

    // Reallocate the buffer for the given subproof and air with the given numRows.
    resizeAirInstance(subproofId, airId, idx, numRows) {
        return this.proofOrchestrator.resizeAirInstance(subproofId, airId, idx, numRows);
    }

    // Free the buffer for the given subproof and air.
    removeAirInstance(subproofId, airId) {
        return this.proofOrchestrator.removeAirInstance(subproofId, airId);
    }
}

module.exports = ProofManagerAPI;
