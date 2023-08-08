class ProofManagerAPI {
    constructor(proofManager) {
        this.proofManager = proofManager;
    }

    getName() {
        return proofManager.getName();
    }

    get pilout() {
        return this.proofManager.pilout;
    }
}

module.exports = ProofManagerAPI;
