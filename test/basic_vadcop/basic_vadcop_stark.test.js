const { executeFullProveTest, checkConstraintsTest, generateSetupTest } = require("../test_utils.js");

const publicInputs = [];

function getSettings() {
    return {
        name: "Basic_vadcop-" + Date.now(),
        airout: {
            airoutFilename: `./test/basic_vadcop/basic_vadcop.pilout`,
        },
        witnessCalculators: [
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
        },
        setup: {
            settings: {
                default: { starkStruct: { "nBits": 10, "nBitsExt": 12, "nQueries": 8, "hashCommits": true, "verificationHashType": "GL", "steps": [ {"nBits": 12}, {"nBits": 8}, {"nBits": 4}] } },
                Rom_0: {starkStruct: { "nBits": 16, "nBitsExt": 18, "nQueries": 8, "hashCommits": true, "verificationHashType": "GL", "steps": [ {"nBits": 18}, {"nBits": 14},{"nBits": 10}, {"nBits": 6} ] } },
            },   
        },
        verifier: { filename: "./src/lib/provers/stark_fri_verifier.js", settings: {} },
    };

}

describe("Basic Vadcop", async function () {
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

    it("Verify a Basic Vadcop constraints", async () => {
        await checkConstraintsTest(setup, publicInputs, optionsVerifyConstraints);
    });

    it.only("Generate a Basic Vadcop proof", async () => {
        await executeFullProveTest(setup, publicInputs, options, config.prover?.genAggregationProof);
    });
});
