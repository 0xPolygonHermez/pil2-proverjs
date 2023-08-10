const Piloutprover = require("./src/pilout_prover.js");
const log = require("./logger.js");

async function run(settings) {
    const piloutProver = new Piloutprover();
    piloutProver.initialize("zkEvmPiloutprover", settings.options);

    const proof = await piloutProver.prove(settings.settings, settings.options);
    log.info("Proof generated");
}

settings = {
    settings: {
        name: "zkEvmProof-" + Date.now(),
        pilout: { piloutFilename: "../pilcom/tmp/pilout.ptb", piloutProto: "../pilcom/src/pilout.proto" },
        witnessCalculators: [
            { witnessCalculatorLib: "./src/lib/witness_calculators/witness_calculator_internal.js", settings: {} },
            { witnessCalculatorLib: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {} },
        ],
        prover: { proverLib: "./src/lib/provers/proverA.js", settings: {} },
        verifier: { verifierLib: "./src/lib/verifiers/verifierA.js", settings: {} },
        setup: "setup",
    },
    options: {
        debug: true,
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
