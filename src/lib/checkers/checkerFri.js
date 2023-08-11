const CheckerComponent = require("../../checker.js");
const log = require('../../../logger.js');

class CheckerA extends CheckerComponent {
    constructor(proofmanagerAPI) {
        super("FRI Checker", proofmanagerAPI);
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, "Not initialized.");
            throw new Error(`[Fflonk Checker] ${this.name}: not initialized.`);
        }
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    check(proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Checking.");
        return true;

    }
}

module.exports = CheckerA;