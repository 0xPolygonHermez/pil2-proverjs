const logger = require('../logger.js');

class ProofManager {
    constructor() {
        this._initialized = false;
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
        /*
         * provingSchema is a JSON object containing the following fields:
            * - name: name of the proof
            * - pilout: pilout of the proof
            * - executors: array of executor types
            * - prover: prover type
            * - setup: setup data
            * 
         */

        if (!this._initialized) {
            logger.error("[ProofManager] ProofManager not initialized.");
            throw new Error("ProofManager not initialized.");
        }

        this.checkProvingSchemaIsValid(provingSchema);

        logger.info(`[ProofManager] Initiating the generation of the proof '${provingSchema.name}'.`);

        logger.info(`[ProofManager] Proof '${provingSchema.name}' successfully generated.`);

        return;
    }

    checkProvingSchemaIsValid(provingSchema) {
        if (!provingSchema.name) {
            provingSchema.name = "proof-" + Date.now();
            logger.warn(`[ProofManager] No name provided in the provingSchema, assigning a default name ${provingSchema.name}.`);
        }

        if (!provingSchema.pilout) {
            logger.error("[ProofManager] No pilout provided in the provingSchema.");
            throw new Error("No pilout provided in the provingSchema.");
        }

        if (!provingSchema.executors) {
            logger.error("[ProofManager] No executors provided in the provingSchema.");
            throw new Error("No executors provided in the provingSchema.");
        }

        if (!provingSchema.prover) {
            logger.error("[ProofManager] No prover provided in the provingSchema.");
            throw new Error("No prover provided in the provingSchema.");
        }

        if (!provingSchema.setup) {
            logger.error("[ProofManager] No setup provided in the provingSchema.");
            throw new Error("No setup provided in the provingSchema.");
        }
    }
}

module.exports = ProofManager;
