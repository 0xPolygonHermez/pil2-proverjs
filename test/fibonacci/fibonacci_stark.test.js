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

const options = {
    parallelExec: false,
    useThreads: false,
    hashCommits: false,
    vadcop: false,
};


describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it("prove Fibonacci", async () => {
        await proveAndVerifyTest(getSettings(), inputs, options);
    });

    it("verify Fibonacci", async () => {
        await proveAndVerifyTest(getSettings(), inputs, { ...options, onlyCheck: true });
    });
});
