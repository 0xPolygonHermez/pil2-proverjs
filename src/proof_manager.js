const log = require("../logger.js");
const { fileExists } = require("./utils.js");
const path = require("path");

const { ExecutorComposite } = require("./executor.js");
const ExecutorFactory = require("./executor_factory.js");
const ProverFactory = require("./prover_factory.js");
const VerifierFactory = require("./verifier_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const PilOut = require("./pilout.js");

class ProofManager {
    constructor() {
        this._initialized = false;
        this._isProving = false;
        if (ProofManager.instance) {
            return ProofManager.instance;
        }

        log.info("[ProofManager]", "ProofManager new instance created.");
        ProofManager.instance = this;
    }

    initialize(name, settings) {
        if (this._initialized) {
            log.error("[ProofManager]", "ProofManager already initialized.");
            throw new Error("ProofManager already initialized.");
        }

        this._name = name;
        this._settings = settings;

        log.info("[ProofManager]", `ProofManager ${name} initialized.`);
        this._initialized = true;
    }

    checkInitialized() {
        if(!this._initialized) {
            log.error("[ProofManager]", `[ProofManager] ${this.name}: not initialized.`);
            throw new Error(`[ProofManager] ${this.name}: not initialized.`);
        }
    }

    getName() {
        this.checkInitialized();
        return this._name;
    }

    async prove(provingSchema, options) {
        if (!this._initialized) {
            log.error("[ProofManager]", "ProofManager not initialized.");
            throw new Error("ProofManager not initialized.");
        }

        if (this._isProving) {
            log.error("[ProofManager]", "ProofManager already generating a proof.");
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
        if (!await provingSchemaIsValid(provingSchema)) {
            this._isProving = false;

            log.error("[ProofManager]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        if (!await ValidateFileNameCorrectness(provingSchema)) {
            this._isProving = false;

            log.error("[ProofManager]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        let proof;
        try {
            await this.initializeProve(provingSchema, options);

            proof = this.generateProof(provingSchema, options);
        } catch (error) {
            log.error("[ProofManager]", `[ProofManager] Error while generating proof: ${error}`);
            throw error;
        } finally {
            this._isProving = false;
            this.finalizeProve(provingSchema, options);
        }

        return proof;

        async function provingSchemaIsValid(provingSchema) {
            if (!provingSchema.name) {
                provingSchema.name = "proof-" + Date.now();
                log.warn("[ProofManager]", `[ProofManager] No name provided in the provingSchema, assigning a default name ${provingSchema.name}.`);
            }

            const fields = ["pilout", "executors", "prover", "setup"];
            for (const field of fields) {
                if (!provingSchema[field]) {
                    log.error("[ProofManager]", `No ${field} provided in the provingSchema.`);
                    return false;
                }
            }

            return true;
        }

        async function ValidateFileNameCorrectness(provingSchema) {
            const piloutFilename =  path.join(__dirname, "..", provingSchema.pilout.piloutFilename);
            if (!await fileExists(piloutFilename)) {
                log.error("[ProofManager]", `Pilout ${piloutFilename} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutFilename = piloutFilename;

            const piloutProto =  path.join(__dirname, "..", provingSchema.pilout.piloutProto);
            if (!await fileExists(piloutProto)) {
                log.error("[ProofManager]", `Pilout proto ${piloutProto} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutProto = piloutProto;

            for(const executor of provingSchema.executors) {
                const executorLib =  path.join(__dirname, "..", executor.executorLib);

                if (!await fileExists(executorLib)) {
                    log.error("[ProofManager]", `Executor ${executor.executorLib} does not exist.`);
                    return false;
                }
                executor.executorLib = executorLib;
            }                
    
            const proverLib =  path.join(__dirname, "..", provingSchema.prover.proverLib);

            if (!await fileExists(proverLib)) {
                log.error("[ProofManager]", `Prover ${provingSchema.prover.proverLib} does not exist.`);
                return false;
            }
            provingSchema.prover.proverLib = proverLib;

            if (!provingSchema.setup) {
                log.error("[ProofManager]", "No setup provided in the provingSchema.");
                return false;
            }

            const verifierLib =  path.join(__dirname, "..", provingSchema.verifier.verifierLib);

            if (!await fileExists(verifierLib)) {
                log.error("[ProofManager]", `Verifier ${provingSchema.verifier.verifierLib} does not exist.`);
                return false;
            }
            provingSchema.verifier.verifierLib = verifierLib;

            return true;
        }

    }

    async initializeProve(provingSchema, options) {
        const proofManagerAPI = new ProofManagerAPI(this);

        this.pilout = new PilOut(provingSchema.pilout.piloutFilename, provingSchema.pilout.piloutProto, options);

        // Initialize the executors
        if (provingSchema.executors.length === 0) {
            log.error("[ProofManager]", "No executors provided in the provingSchema.");
            this._isProving = false;
            throw new Error("No executors provided in the provingSchema.");
        }

        this.executors = new ExecutorComposite(proofManagerAPI);

        for(const executor of provingSchema.executors) {
            const newExecutor = await ExecutorFactory.createExecutor(executor.executorLib, proofManagerAPI);
            newExecutor.initialize(executor.settings);

            this.executors.registerExecutor(newExecutor);
        }

        this.prover = await ProverFactory.createProver(provingSchema.prover.proverLib, proofManagerAPI);
        this.prover.initialize(provingSchema.prover.settings);

        this.verifier = await VerifierFactory.createVerifier(provingSchema.verifier.verifierLib, proofManagerAPI);
        this.verifier.initialize(provingSchema.verifier.settings);

        // TODO Initialize setup

    }

    generateProof(provingSchema, options) {
        log.info("[ProofManager]", `--> Initiating the generation of the proof '${provingSchema.name}'.`
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

        log.info("[ProofManager]", `<-- Proof '${provingSchema.name}' successfully generated.`);

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
