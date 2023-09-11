const ProofManager = require("./src/proof_manager.js");
const log = require("./logger.js");

async function run(settings) {
    const proofManager = new ProofManager();
    proofManager.initialize("zkEvmProofManager", settings.options);

    const proof = await proofManager.prove(settings.settings, settings.options);
    log.info("Proof generated");
}

proofSettings = {
    settings: {
        name: "zkEvmProof-" + Date.now(),
        pilout: {
            piloutFilename: "./test/simple/simple1/simple1.pilout",
            piloutProto: "../pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: "./test/simple/simple1/simple1_executor.js", type: "main", settings: {parallelExec: false, useThreads: false} },
            { filename: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {},},
        ],
        prover: {
            filename: "./src/lib/provers/stark_prover.js",
            settings: { starkStruct: "./test/simple/simple1/simple1_stark_struct.json", parallelExec: false, useThreads: false },
        },
        checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
        setup: "setup",
    },
    options: {
        debug: true,
        verify: true
    },
};

// proofSettings = {
//     settings: {
//         name: "zkEvmProof-" + Date.now(),
//         pilout: { piloutFilename: "./test/fibonacci_vadcop/fibonacci_vadcop.pilout", piloutProto: "../pilcom/src/pilout.proto" },
//         witnessCalculators: [
//             { file: "./test/fibonacci_vadcop/executor_fibonacci_vadcop.js", settings: {} },
//             { file: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {} },
//         ],
//         prover: { filename: "./src/lib/provers/stark_prover.js", settings: {} },
//         checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
//         setup: "setup",
//     },
//     options: {
//         debug: true,
//     },
// };

run(proofSettings).then(
    () => {
        process.exit(0);
    },
    (err) => {
        console.log(err.message);
        console.log(err.stack);
        process.exit(1);
    }
);
