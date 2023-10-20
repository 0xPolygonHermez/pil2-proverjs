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

async function runPilVerifier(prefix) {
    const proofManagerConfig = getSettings(prefix);

    const options = {
        debug: true,
        hashCommits: true,
        parallelExec: false,
        useThreads: false
    };

    const proofOrchestrator = new ProofOrchestrator("SimpleProofOrchestrator");

    await proofOrchestrator.initialize(proofManagerConfig, options);

    await proofOrchestrator.verifyPil({});
}

describe("PIL2 proof manager stark simple tests", async function () {
    this.timeout(10000000);

    it("prove Simple1", async () => {
        await proveAndVerifyTest(getSettings("Simple1"), {});
    });

    it("prove Simple2", async () => {
        await proveAndVerifyTest(getSettings("Simple2"), {});
    });

    it("prove Simple3", async () => {
        await proveAndVerifyTest(getSettings("Simple3"), {});
    });

    it("prove Simple4", async () => {
        await proveAndVerifyTest(getSettings("Simple4"), { in1: 2, in2: 3 });
    });

    it("verify PIL Simple1", async () => {
        await runPilVerifier("Simple1");
    });

    it("verify PIL Simple2", async () => {
        await runPilVerifier("Simple2");
    });

    it("verify PIL Simple3", async () => {
        await runPilVerifier("Simple3");
    });

    it("verify PIL Simple4", async () => {
        await runPilVerifier("Simple4");
    });
});
