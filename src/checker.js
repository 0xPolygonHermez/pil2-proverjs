// Abstract base class for all Checker components
const log = require('../logger.js');

class CheckerComponent {
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

    check() {
        throw new Error("Method 'check' must be implemented in concrete classes.");
    }
}

module.exports = CheckerComponent;