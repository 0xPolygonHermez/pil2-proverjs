// Abstract base class for all Verifier components
const log = require('../logger.js');

class VerifierComponent {
    constructor(name) {
        this.name = name;

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

    checkProof() {
        throw new Error("Method 'check' must be implemented in concrete classes.");
    }
}

module.exports = VerifierComponent;