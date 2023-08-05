const ProofManager = require("./proof_manager.js");

const proofManager = new ProofManager();

class ProofManagerAPI {
    static getName() {
        return proofManager.getName();
    }
}

module.exports = ProofManagerAPI;
