const { assert } = require("chai");

const { executeFullProveTest, checkConstraintsTest } = require("../test_utils.js");

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
        verifier: { filename: "./src/lib/verifiers/stark_fri_verifier.js", settings: {} },
    };

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
        await executeFullProveTest(getSettings(), publicInputs, options, true);
    });

    it("Verify a Fibonacci Vadcop proof", async () => {
        await checkConstraintsTest(getSettings(), publicInputs, options);
    });
});
