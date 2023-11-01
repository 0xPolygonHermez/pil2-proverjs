const { executeFullProveTest, checkConstraintsTest } = require("../test_utils.js");

const inputs = { in1: 1n, in2: 2n };

function getSettings() {
    return {
        name: "Fibonacci-" + Date.now(),
        airout: {
            airoutFilename: `./test/fibonacci/fibonacci.airout`,
        },
        witnessCalculators: [
            { filename: `./test/fibonacci/fibonacci_executor.js`, settings: {} },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/fibonacci/fibonacci_stark_struct.json` },
            },
        },
        verifier: { filename: "./src/lib/provers/stark_fri_verifier.js", settings: {} },
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
        await executeFullProveTest(getSettings(), inputs, options, true);
    });

    it("verify Fibonacci", async () => {
        await checkConstraintsTest(getSettings(), inputs, options);
    });
});
