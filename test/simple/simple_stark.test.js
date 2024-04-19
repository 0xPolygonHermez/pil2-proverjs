const { executeFullProveTest, checkConstraintsTest, generateSetupTest } = require("../test_utils.js");

function getSettings(prefix) {
    return {
        name: prefix + "-" + Date.now(),
        airout: {
            airoutFilename: `./test/simple/${prefix}/${prefix}.airout`,
        },
        witnessCalculators: [
            { filename: `./test/simple/${prefix}/${prefix}_executor.js`, sm: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`, settings: { } },
        ],
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
            settings: {
                default: { starkStruct: `./test/simple/${prefix}/${prefix}_stark_struct.json` },
            },
        },
        verifier: {
            filename: "./src/lib/provers/stark_fri_verifier.js",
            settings: {},
        },
    };
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    const options = {
        parallelExec: false,
        useThreads: false,
    };

    const optionsVerifyConstraints = {...options, onlyCheck: true};

    describe("Simple1", async function () {

        let setup1;

        before(async () => {
            let config = getSettings("simple1");
            setup1 = await generateSetupTest(config);
        });

        it("verify PIL Simple1 constraints", async () => {
            await checkConstraintsTest(setup1, {}, optionsVerifyConstraints);
        });

        it("prove Simple1", async () => {
            await executeFullProveTest(setup1, {}, options, true);
        });
    });

    describe("Simple2", async function () {
        let setup2;

        before(async () => {
            let config = getSettings("simple2");
            setup2 = await generateSetupTest(config);
        });

        it("verify PIL Simple2 constraints", async () => {
            await checkConstraintsTest(setup2, {}, optionsVerifyConstraints);
        })

        it("prove Simple2", async () => {
            await executeFullProveTest(setup2, {}, options, true);
        });
    });

    describe("Simple3", async function () {
        let setup3;

        before(async () => {
            let config = getSettings("simple3");
            setup3 = await generateSetupTest(config);
        });

        it("verify PIL Simple3 constraints", async () => {
            await checkConstraintsTest(setup3, {}, optionsVerifyConstraints);
        })

        it("prove Simple3", async () => {
            await executeFullProveTest(setup3, {}, options, true);
        });
    });


    describe("Simple4", async function () {
        let setup4;

        before(async () => {
            let config = getSettings("simple4");
            setup4 = await generateSetupTest(config);
        });

        it("verify PIL Simple4 constraints", async () => {
            await checkConstraintsTest(setup4, { in1: 1n , in2: 343n }, optionsVerifyConstraints);
        })

        it("prove Simple4", async () => {
            await executeFullProveTest(setup4, { in1: 1n , in2: 343n }, options, true);
        });
    });
});
