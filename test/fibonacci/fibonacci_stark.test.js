const ProofOrchestrator = require("../../src/proof_orchestrator.js");

const { proveAndVerifyTest } = require("../test_utils.js");

const inputs = { in1: 1n, in2: 2n };

function getSettings() {
    return {
        name: "Fibonacci-" + Date.now(),
        airout: {
            airoutFilename: `./test/fibonacci/fibonacci.airout`,
            airoutProto: "./node_modules/pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            { filename: `./test/fibonacci/fibonacci_executor.js`, settings: {} },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/fibonacci/fibonacci_stark_struct.json` },
            },
        },        checker: { filename: "./src/lib/checkers/stark_fri_checker.js", settings: {} },
    };

}

async function runPilVerifier(publics) {
    const proofManagerConfig = getSettings();

    const options = {
        debug: true,
        parallelExec: false,
        useThreads: false
    };

    const proofOrchestrator = new ProofOrchestrator("FibonacciProofOrchestrator");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    await proofOrchestrator.verifyPil(publics);
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it("prove Fibonacci", async () => {
        await proveAndVerifyTest(getSettings(), inputs);
    });

    it("verify Fibonacci", async () => {
        await runPilVerifier(inputs);
    });
});
