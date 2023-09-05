const ProofManager = require("./src/proof_manager.js");
const log = require("./logger.js");

async function run(settings) {
    const proofManager = new ProofManager();
    proofManager.initialize("zkEvmProofManager", settings.options);

    const proof = await proofManager.prove(settings.settings, settings.options);
    log.info("Proof generated");
}

proveSettings = {
    settings: {
        name: "zkEvmProof-" + Date.now(),
        pilout: { piloutFilename: "./test/fibonacci_vadcop/fibonacci_vadcop.pilout", piloutProto: "../pilcom/src/pilout.proto" },
        witnessCalculators: [
            { witnessCalculatorLib: "./test/fibonacci_vadcop/executor_fibonacci_vadcop.js", settings: {} },
            { witnessCalculatorLib: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {} },
        ],
        prover: { proverLib: "./src/lib/provers/eSTARKProver.js", settings: {} },
        checker: { checkerLib: "./src/lib/checkers/eSTARKChecker.js", settings: {} },
        setup: "setup",
    },
    options: {
        debug: true,
    },
};

run(proveSettings).then(
    () => {
        process.exit(0);
    },
    (err) => {
        console.log(err.message);
        console.log(err.stack);
        process.exit(1);
    }
);
