const ProofOrchestrator = require("../proof_orchestrator.js");

module.exports = async function proveCmd(proofManagerConfig, publics, options) {
    const proofOrchestrator = new ProofOrchestrator("SimpleProofOrchestrator");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    return await proofOrchestrator.generateProof(publics);
}