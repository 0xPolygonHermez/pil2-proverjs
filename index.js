const ProofManager = require("./src/proof_manager.js");
const ProofManagerAPI = require("./src/proof_manager_api.js");
const { Executor } = require("./src/executor/executor.js");
const ExecutorA = require("./src/executor/executorA.js");
const ExecutorB = require("./src/executor/executorB.js");

const logger = require('./logger.js');

const proofManager = new ProofManager();
proofManager.initialize("zkEvmProofmanager", {settings: {}});

// // Client code
// const executor = new Executor();
// const executorA = new ExecutorA();
// const executorB = new ExecutorB();

// executor.registerExecutor(executorA);
// executor.registerExecutor(executorB);
// // To start the resolution process, call resolve() on the Executor
// executor.witnessComputation(0);

proofManager.prove(
    {
        name: "zkEvmProof-" + Date.now(),
        pilout: "pilout",
        executors: ["Executor Type A", "Executor Type B"],
        prover: "prover",
        setup: "setup"
    }
);
