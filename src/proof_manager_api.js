const ProofManager = require("./proof_manager.js");

class ProofManagerAPI {
    constructor(proofManager) {
        this.proofManager = proofManager;
    }

    getName() {
        return proofManager.getName();
    }
}

module.exports = ProofManagerAPI;
