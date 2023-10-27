const { executeFullProveTest, checkConstraintsTest } = require("../test_utils.js");

function getSettings(prefix) {
    return {
        name: prefix + "-" + Date.now(),
        airout: {
            airoutFilename: `./test/simple/${prefix}/${prefix}.airout`,
            airoutProto: "./node_modules/pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            { filename: `./test/simple/${prefix}/${prefix}_executor.js`, sm: `${prefix}`, settings: { } },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/simple/${prefix}/${prefix}_stark_struct.json` },
            },
        },
        verifier: {
            filename: "./src/lib/verifiers/stark_fri_verifier.js",
            settings: {},
        },
    };
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    const options = {
        parallelExec: false,
        useThreads: false,
        hashCommits: false,
        vadcop: false,
    };

    it("prove Simple1", async () => {
        await executeFullProveTest(getSettings("Simple1"), {}, options, true);
    });

    it("prove Simple2", async () => {
        await executeFullProveTest(getSettings("Simple2"), {}, options, true);
    });

    it("prove Simple3", async () => {
        await executeFullProveTest(getSettings("Simple3"), {}, options, true);
    });

    it("prove Simple4", async () => {
        await executeFullProveTest(getSettings("Simple4"), { in1: 1n , in2: 343n }, options, true);
    });

    it("verify PIL Simple1", async () => {
        await checkConstraintsTest(getSettings("Simple1"), {}, options);
    });

    it("verify PIL Simple2", async () => {
        await checkConstraintsTest(getSettings("Simple2"), {}, options);
    });

    it("verify PIL Simple3", async () => {
        await checkConstraintsTest(getSettings("Simple3"), {}, options);
    });

    it("verify PIL Simple4", async () => {
        await checkConstraintsTest(getSettings("Simple4"), { in1: 1n , in2: 343n }, options);
    });
});
