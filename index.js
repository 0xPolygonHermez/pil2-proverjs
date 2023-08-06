const ProofManager = require("./src/proof_manager.js");

const proofManager = new ProofManager();
proofManager.initialize("zkEvmProofmanager", {settings: {}});

proofManager.prove(
    {
        name: "zkEvmProof-" + Date.now(),
        pilout: "pilout",
        executors: [{ type: "executorA" }, { type: "executorB" }],
        prover: "prover",
        setup: "setup"
    },
    {
        debug: false
    }
);
