const logger = require('../logger.js');

const { Executor } = require("./executor/executor.js");
const ExecutorA = require("./executor/executorA.js");
const ExecutorB = require("./executor/executorB.js");

class ProofManager {
    constructor() {
        this._initialized = false;
        this._isProving = false;
        if (ProofManager.instance) {
            return ProofManager.instance;
        }

        logger.info("[ProofManager] ProofManager new instance created.");
        ProofManager.instance = this;
    }

    initialize(name, settings) {
        if (this._initialized) {
            logger.error("[ProofManager] ProofManager already initialized.");
            throw new Error("ProofManager already initialized.");
        }

        this._name = name;
        this._settings = settings;

        logger.info(`[ProofManager] ProofManager ${name} initialized.`);
        this._initialized = true;
    }

    getName() {
        return this._name;
    }

    prove(provingSchema) {
        if (!this._initialized) {
            logger.error("[ProofManager] ProofManager not initialized.");
            throw new Error("ProofManager not initialized.");
        }

        if(this._isProving) {
            logger.error("[ProofManager] ProofManager already generating a proof.");
            throw new Error("ProofManager already generating a proof.");
        }
        // TODO must do it with a semaphore?
        this._isProving = true;

        /*
         * provingSchema is a JSON object containing the following fields:
            * - name: name of the proof
            * - pilout: pilout of the proof
            * - executors: array of executor types
            * - prover: prover type
            * - setup: setup data
            * 
         */
        if(!this.provingSchemaIsValid(provingSchema)) {
            logger.error("[ProofManager] Invalid provingSchema.");
            this._isProving = false;
            throw new Error("Invalid provingSchema.");
        }

        // Initialize the proof structures
        const executor = new Executor();
        const executorA = new ExecutorA();
        const executorB = new ExecutorB();

        executor.registerExecutor(executorA);
        executor.registerExecutor(executorB);

        logger.info(`[ProofManager] Initiating the generation of the proof '${provingSchema.name}'.`);

        // To start the resolution process, call resolve() on the Executor
        executor.witnessComputation(0);


        logger.info(`[ProofManager] Proof '${provingSchema.name}' successfully generated.`);

        this._isProving = false;

        return;
    }

    provingSchemaIsValid(provingSchema) {
        if (!provingSchema.name) {
            provingSchema.name = "proof-" + Date.now();
            logger.warn(`[ProofManager] No name provided in the provingSchema, assigning a default name ${provingSchema.name}.`);
        }

        if (!provingSchema.pilout) {
            logger.error("[ProofManager] No pilout provided in the provingSchema.");
            return false;
        }

        if (!provingSchema.executors) {
            logger.error("[ProofManager] No executors provided in the provingSchema.");
            return false;
        }

        if (!provingSchema.prover) {
            logger.error("[ProofManager] No prover provided in the provingSchema.");
            return false;
        }

        if (!provingSchema.setup) {
            logger.error("[ProofManager] No setup provided in the provingSchema.");
            return false;
        }

        return true;
    }
}

module.exports = ProofManager;
