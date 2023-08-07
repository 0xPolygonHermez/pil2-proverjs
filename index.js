const ProofManager = require("./src/proof_manager.js");

const proofManager = new ProofManager();
proofManager.initialize("zkEvmProofmanager", {settings: {}});

proofManager.prove(
    {
        name: "zkEvmProof-" + Date.now(),
        pilout: "pilout",
        executors: [{ type: "executorA", settings: {} }, { type: "executorB", settings: {} }],
        prover: { 
            prover: { type: "proverA", settings: {}},
            verifier: { type: "verifierA", settings: {}},
        },
        setup: "setup"
    },
    {
        debug: false
    }
);
