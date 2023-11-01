const ProofOrchestrator = require("../proof_orchestrator.js");

module.exports = async function proveCmd(setup, publics, options) {
    const proofOrchestrator = new ProofOrchestrator("Proof Orch");

    await proofOrchestrator.initialize(setup.config, options);
    
    return await proofOrchestrator.generateProof(setup, publics);
}
