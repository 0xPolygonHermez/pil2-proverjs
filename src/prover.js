// Abstract base class for all Prover components
const log = require('../logger.js');

class ProverComponent {
    constructor(name, proofmanagerAPI) {
        this.name = name;
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    commitStage(stageId) {
        throw new Error("Method 'commitStage' must be implemented in concrete classes.");
    }

    prove() {
        throw new Error("Method 'computeQ' must be implemented in concrete classes.");
    }
}

module.exports = ProverComponent;