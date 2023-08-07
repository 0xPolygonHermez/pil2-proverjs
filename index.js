const ProofManager = require("./src/proof_manager.js");
const logger = require("./logger.js");

async function run(settings) {
    const proofManager = new ProofManager();
    proofManager.initialize("zkEvmProofmanager", settings.options);

    const proof = await proofManager.prove(settings.settings);

    logger.info("Proof generated");
}

settings = {
    settings: {
        name: "zkEvmProof-" + Date.now(),
        pilout: "pilout",
        executors: [
            { executorLib: "./src/lib/executors/executorA.js", settings: {} },
            { executorLib: "./src/lib/executors/executorB.js", settings: {} },
        ],
        prover: {
            prover: { type: "proverA", settings: {} },
            verifier: { type: "verifierA", settings: {} },
        },
        setup: "setup",
    },
    options: {
        debug: false,
    },
};

run(settings).then(
    () => {
        process.exit(0);
    },
    (err) => {
        console.log(err.message);
        console.log(err.stack);
        process.exit(1);
    }
);
