const { executeFullProveTest, checkConstraintsTest, generateSetupTest } = require("../test_utils.js");

const publicInputs = [1n, 2n, undefined];

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
        aggregation: {
            settings: {},
            genProof: false,
        },
        verifier: { filename: "./src/lib/provers/stark_fri_verifier.js", settings: {} },
    };
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);
   
    const options = {
        parallelExec: true,
        useThreads: true,
    };

    const optionsVerifyConstraints = {...options, onlyCheck: true};

    let setup;
    let config;

    before(async () => {
        config = getSettings();
        setup = await generateSetupTest(config);
    });

    it("verify Fibonacci constraints", async () => {
        await checkConstraintsTest(setup, publicInputs, optionsVerifyConstraints);
    });

    it("prove Fibonacci", async () => {
        await executeFullProveTest(setup, publicInputs, options, config.aggregation?.genProof);
    });

});
