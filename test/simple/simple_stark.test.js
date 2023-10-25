const ProofOrchestrator = require("../../src/proof_orchestrator.js");

const { proveAndVerifyTest } = require("../test_utils.js");

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
        checker: {
            filename: "./src/lib/checkers/stark_fri_checker.js",
            settings: {},
        },
    };
}

function getInputs(prefix) {
    return {
        filename: `./test/simple/${prefix}/${prefix}_inputs.json`,
    }
}

async function runPilVerifier(prefix, publics, options) {
    options = {...options, debug: true};

    const proofManagerConfig = getSettings(prefix);

    const proofOrchestrator = new ProofOrchestrator("SimpleProofOrchestrator");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    await proofOrchestrator.verifyPil(publics);
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
        await proveAndVerifyTest(getSettings("Simple1"), {}, options);
    });

    it("prove Simple2", async () => {
        await proveAndVerifyTest(getSettings("Simple2"), {}, options);
    });

    it("prove Simple3", async () => {
        await proveAndVerifyTest(getSettings("Simple3"), {}, options);
    });

    it("prove Simple4", async () => {
        await proveAndVerifyTest(getSettings("Simple4"), { in1: 1n , in2: 343n }, options);
    });

    it("verify PIL Simple1", async () => {
        await runPilVerifier("Simple1", {}, options);
    });

    it("verify PIL Simple2", async () => {
        await runPilVerifier("Simple2", {}, options);
    });

    it("verify PIL Simple3", async () => {
        await runPilVerifier("Simple3", {}, options);
    });

    it("verify PIL Simple4", async () => {
        await runPilVerifier("Simple4", { in1: 1n , in2: 343n }, options);
    });
});
