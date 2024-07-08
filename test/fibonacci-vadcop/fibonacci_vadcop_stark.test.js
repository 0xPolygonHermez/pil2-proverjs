const { executeFullProveTest, checkConstraintsTest, generateSetupTest } = require("../test_utils.js");

const publicInputs = [5n, 1n, 1n, undefined];

function getSettings() {
    return {
        name: "Fibonacci-vadcop-" + Date.now(),
        airout: {
            airoutFilename: `./test/fibonacci-vadcop/fibonacci_vadcop.airout`,
        },
        witnessCalculators: [
            { filename: `./test/fibonacci-vadcop/executor_fibonacci.js`, settings: {}, sm: "Fibonacci" },
            { filename: `./test/fibonacci-vadcop/executor_module.js`, settings: {}, sm: "Module" },
            { filename: `./src/lib/witness_calculators/logup.js`, settings: {} },
            { filename: `./src/lib/witness_calculators/div_lib.js`, settings: {}, },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { },
                Fibonacci_2: {starkStruct: `./test/fibonacci-vadcop/fibonacci_vadcop_stark_struct_2_2.json` },
            },   
        },
        aggregation: {
            settings: {
                recursive: { starkStruct: "./src/recursion/configs/recursive.starkstruct.json" },
                final: { starkStruct: "./src/recursion/configs/final.starkstruct.json" }
            },
            genProof: true,
            genSetup: false,
        },
        verifier: { filename: "./src/lib/provers/stark_fri_verifier.js", settings: {} },
    };

}

describe("Fibonacci Vadcop", async function () {
    this.timeout(10000000);

    const options = {
        parallelExec: true,
        useThreads: true,
        vadcop: true,
    };

    const optionsVerifyConstraints = {...options, onlyCheck: true};

    let setup;

    let config;

    before(async () => {
        config = getSettings();
        setup = await generateSetupTest(config);
    });

    it("Verify a Fibonacci Vadcop constraints", async () => {
        await checkConstraintsTest(setup, publicInputs, optionsVerifyConstraints);
    });

    it.only("Generate a Fibonacci Vadcop proof", async () => {
        await executeFullProveTest(setup, publicInputs, options, config.aggregation?.genProof);
    });
});
