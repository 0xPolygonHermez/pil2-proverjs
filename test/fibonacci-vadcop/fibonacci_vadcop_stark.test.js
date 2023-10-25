const ProofOrchestrator = require("../../src/proof_orchestrator.js");

const { proveAndVerifyTest } = require("../test_utils.js");

const publicInputs = { in1: 1n, in2: 1n, mod: 5n };

function getSettings() {
    return {
        name: "Fibonacci-vadcop-" + Date.now(),
        airout: {
            airoutFilename: `./test/fibonacci-vadcop/fibonacci_vadcop.airout`,
            airoutProto: "./node_modules/pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            { filename: `./test/fibonacci-vadcop/executor_fibonacci.js`, settings: {}, sm: "Fibonacci" },
            { filename: `./test/fibonacci-vadcop/executor_module.js`, settings: {}, sm: "Module" },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/fibonacci-vadcop/fibonacci_vadcop_stark_struct_2_4.json` },
                Fibonacci_2: {starkStruct: `./test/fibonacci-vadcop/fibonacci_vadcop_stark_struct_2_2.json` },
            },
        },
        checker: { filename: "./src/lib/checkers/stark_fri_checker.js", settings: {} },
    };

}

async function runPilVerifier(publicInputs, options) {
    options = {...options, debug: true};

    const proofManagerConfig = getSettings();

    const proofOrchestrator = new ProofOrchestrator("Proof Orch");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    await proofOrchestrator.verifyPil(publicInputs);
}

describe("Fibonacci Vadcop", async function () {
    this.timeout(10000000);

    const options = {
        parallelExec: false,
        useThreads: false,
        hashCommits: true,
        vadcop: true,
    };

    it("Generate a Fibonacci Vadcop proof", async () => {
        await proveAndVerifyTest(getSettings(), publicInputs, options);
    });

    it("Verify a Fibonacci Vadcop proof", async () => {
        await runPilVerifier(publicInputs, options);
    });
});
