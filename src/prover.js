// Abstract base class for all Prover components
const log = require('../logger.js');

class ProverComponent {
    constructor(name, proofmanagerAPI) {
        this.name = name;
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.settings = null;
    }

    initialize(settings) {
        log.info(`[${this.name}]`, "Initializing.");

        this.settings = settings;
        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    async setupProof(subproofCtx, airId, airInstanceId) {
        throw new Error("Method 'setupProof' must be implemented in concrete classes.");
    }

    async commitStage(stageId, airInstanceCtx) {
        throw new Error("Method 'commitStage' must be implemented in concrete classes.");
    }

    getProverCallbacks() {
        throw new Error("Method 'getProverCallbacks' must be implemented in concrete classes.");
    }    
}

module.exports = ProverComponent;