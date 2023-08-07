const logger = require("../logger.js");
const path = require("path");

const { ExecutorComposite } = require("./executor/executor.js");
const ExecutorFactory = require("./executor/executor_factory.js");
const ProverFactory = require("./prover/prover_factory.js");

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

    checkInitialized() {
        if(!this._initialized) {
            logger.error(`[ProofManager] ${this.name}: not initialized.`);
            throw new Error(`[ProofManager] ${this.name}: not initialized.`);
        }
    }

    getName() {
        this.checkInitialized
        return this._name;
    }

    async prove(provingSchema, options) {
        if (!this._initialized) {
            logger.error("[ProofManager] ProofManager not initialized.");
            throw new Error("ProofManager not initialized.");
        }

        if (this._isProving) {
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
        if (!this.provingSchemaIsValid(provingSchema)) {
            this._isProving = false;

            logger.error("[ProofManager] Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        let proof;
        try {
            await this.initializeProve(provingSchema, options);

            proof = this.generateProof(provingSchema, options);
        } catch (error) {
            logger.error(`[ProofManager] Error while generating proof: ${error}`);
            throw error;
        } finally {
            this._isProving = false;
            this.finalizeProve(provingSchema, options);
        }

        return proof;
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
            logger.error(
                "[ProofManager] No setup provided in the provingSchema."
            );
            return false;
        }

        return true;
    }

    async initializeProve(provingSchema) {
        // TODO Initialize pilout

        // Initialize the executors
        if (provingSchema.executors.length === 0) {
            logger.error(
                "[ProofManager] No executors provided in the provingSchema."
            );
            this._isProving = false;
            throw new Error("No executors provided in the provingSchema.");
        }

        this.executors = new ExecutorComposite();

        for(const executor of provingSchema.executors) {
            const executorLib =  path.join(__dirname, "..", executor.executorLib);
            const newExecutor = await ExecutorFactory.createExecutor(executorLib);
            newExecutor.initialize(executor.settings);

            this.executors.registerExecutor(newExecutor);
        }

        this.prover = ProverFactory.createProver(provingSchema.prover.prover.type);
        this.prover.initialize(provingSchema.prover.prover.settings);

        // TODO Initialize setup
    }

    generateProof(provingSchema) {
        logger.info(
            `[ProofManager] Initiating the generation of the proof '${provingSchema.name}'.`
        );

        const proof = {};

        const nMockStages = 3;
        for(let i = 0; i < nMockStages; i++) {
            this.executors.witnessComputation(i);

            this.prover.commitStage(i, proof);
        }

        this.prover.computeQ(proof);

        this.prover.computeOpenings(proof);

        this.prover.finalizeProof(proof);

        logger.info(
            `[ProofManager] Proof '${provingSchema.name}' successfully generated.`
        );

        return proof;
    }

    finalizeProve(provingSchema, options) {
        // TODO Finalize pilout
        if (this.executors) delete this.executors;
        // TODO Finalize prover
        // TODO Finalize setup
    }
}

module.exports = ProofManager;
