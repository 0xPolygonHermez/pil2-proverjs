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
        pilout: { piloutFilename: "./test/fibonacci/fibonacci.pilout", piloutProto: "../pilcom/src/pilout.proto" },
        witnessCalculators: [
            { witnessCalculatorLib: "./test/fibonacci/witness_calculator_fibonacci.js", settings: {} },
            { witnessCalculatorLib: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {} },
        ],
        prover: { proverLib: "./src/lib/provers/proverFri.js", settings: {} },
        checker: { checkerLib: "./src/lib/checkers/checkerFri.js", settings: {} },
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
