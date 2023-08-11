const ProverComponent = require("../../prover.js");
const log = require('../../../logger.js');

class ProverFri extends ProverComponent {
    constructor(proofmanagerAPI) {
        super("FRI Prover", proofmanagerAPI);
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    commitStage(stageId, proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `Committing stage ${stageId}.`);

        this.checkInitialized();
    }

    computeQ(proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Computing Q.");

        this.checkInitialized();
    }

    computeOpenings(proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Computing Openings.");

        this.checkInitialized();
    }

    finalizeProof(proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Finalizing proof.");

        proof.commitments = [];
        proof.openings = [];
    }
}

module.exports = ProverFri;