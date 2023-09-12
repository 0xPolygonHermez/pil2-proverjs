const ProofManager = require("../../src/proof_manager.js");
const log = require("../../logger.js");

async function runTest(prefix) {
    const proofManagerConfig = {
        name: "zkEvmProof-" + Date.now(),
        pilout: {
            piloutFilename: `./test/simple/${prefix}/${prefix}.pilout`,
            piloutProto: "./node_modules/pilcom2/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: `./test/simple/${prefix}/${prefix}_executor.js`, type: "main", settings: { parallelExec: false, useThreads: false } },
            // { filename: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {},},
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: { starkStruct: `./test/simple/${prefix}/${prefix}_stark_struct.json`, parallelExec: false, useThreads: false },
        },
        checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
        setup: "setup",
    };

    const options = {
        debug: true,
        verify: true
    };

    const proofManager = new ProofManager("zkEvmProofManager");

    await proofManager.initialize(proofManagerConfig);

    const proof = await proofManager.prove(options);

    log.info("Proof generated");
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it.only("Simple1", async () => { await runTest("simple1"); });

    it.only("Simple2", async () => { await runTest("simple2"); });

    it.only("Simple3", async () => { await runTest("simple3"); });
});
