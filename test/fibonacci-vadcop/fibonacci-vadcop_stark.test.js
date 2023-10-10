const ProofOrchestrator = require("../../src/proof_orchestrator.js");

const { proveAndVerifyTest } = require("../test_utils.js");

const log = require("../../logger.js");

function getSettings() {
    return {
        name: "Fibonacci-vadcop-" + Date.now(),
        pilout: {
            piloutFilename: `./test/fibonacci-vadcop/fibonacci-vadcop.pilout`,
            piloutProto: "./node_modules/pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: `./test/fibonacci-vadcop/fibonacci-vadcop_executor.js`, settings: {} },
            // { filename: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {},},
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/fibonacci-vadcop/fibonacci-vadcop_stark_struct.json` },
            },
        },        checker: { filename: "./src/lib/checkers/stark_fri_checker.js", settings: {} },
    };

}

async function runPilVerifier() {
    const proofManagerConfig = getSettings();

    const options = {
        debug: true,
        parallelExec: false,
        useThreads: false
    };

    const proofOrchestrator = new ProofOrchestrator("FiboVadcopPO");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    await proofOrchestrator.verifyPil();
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it("prove Fibonacci-vadcop", async () => {
        await proveAndVerifyTest(getSettings(), { "publics[2]": 12437053821496257494n });
    });

    it("verify Fibonacci-vadcop", async () => {
        await runPilVerifier();
    });
});
