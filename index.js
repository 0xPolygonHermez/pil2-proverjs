const ProofManager = require("./src/proof_manager.js");

const proofManager = new ProofManager();
proofManager.initialize("zkEvmProofmanager", {settings: {}});

proofManager.prove(
    {
        name: "zkEvmProof-" + Date.now(),
        pilout: "pilout",
        executors: ["Executor Type A", "Executor Type B"],
        prover: "prover",
        setup: "setup"
    }
);
