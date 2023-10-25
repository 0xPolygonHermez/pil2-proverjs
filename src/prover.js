// Abstract base class for all Prover components
const log = require('../logger.js');

class ProverComponent {
    constructor(name, proofCtx) {
        this.name = name;
        this.proofCtx = proofCtx;

        this.initialized = false;
        this.settings = null;
        this.options = null;
    }

    initialize(settings, options) {
        log.info(`[${this.name}]`, "Initializing...");

        this.settings = settings;
        this.options = options;
        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    async newProof(subproofCtx, airId, instanceId) {
        throw new Error("Method 'newProof' must be implemented in concrete classes.");
    }

    async commitStage(stageId, airInstance) {
        throw new Error("Method 'commitStage' must be implemented in concrete classes.");
    }

    getProverCallbacks() {
        throw new Error("Method 'getProverCallbacks' must be implemented in concrete classes.");
    }    
}

module.exports = ProverComponent;