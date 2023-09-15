const ProofManager = require("../../src/proof_manager.js");
const log = require("../../logger.js");

async function runProver(prefix) {
    const proofManagerConfig = {
        name: "zkEvmProof-" + Date.now(),
        pilout: {
            piloutFilename: `./test/simple/${prefix}/${prefix}.pilout`,
            piloutProto: "./node_modules/pilcom2/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: `./test/simple/${prefix}/${prefix}_executor.js`, settings: {} },
            // { filename: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {},},
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: { starkStruct: `./test/simple/${prefix}/${prefix}_stark_struct.json` },
        },
        checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
        setup: "setup",
    };

    const options = {
        verify: true,
        parallelExec: false,
        useThreads: false
    };

    const proofManager = new ProofManager("zkEvmProofManager");

    await proofManager.initialize(proofManagerConfig, options);

    const proof = await proofManager.prove();

    log.info("Proof generated");
}

async function runPilVerifier(prefix) {
    const proofManagerConfig = {
        name: "zkEvmProof-" + Date.now(),
        pilout: {
            piloutFilename: `./test/simple/${prefix}/${prefix}.pilout`,
            piloutProto: "./node_modules/pilcom2/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: `./test/simple/${prefix}/${prefix}_executor.js`, settings: {} },
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
        parallelExec: false,
        useThreads: false
    };

    const proofManager = new ProofManager("zkEvmProofManager");

    await proofManager.initialize(proofManagerConfig, options);

    await proofManager.verifyPil();
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it.only("prove Simple1", async () => { await runProver("simple1"); });

    it.only("prove Simple2", async () => { await runProver("simple2"); });

    it.only("prove Simple3", async () => { await runProver("simple3"); });

    it.only("verify PIL Simple1", async () => { await runPilVerifier("simple1"); });

    it.only("verify PIL Simple2", async () => { await runPilVerifier("simple2"); });

    it.only("verify PIL Simple3", async () => { await runPilVerifier("simple3"); });
});
