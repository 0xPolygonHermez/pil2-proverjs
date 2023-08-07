const VerifierComponent = require("./verifier.js");
const logger = require('../../logger.js');

class VerifierA extends VerifierComponent {
    constructor() {
        super("Fflonk Verifier");
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[Fflonk Verifier] ${this.name}: not initialized.`);
        }
    }

    initialize() {
        logger.info(`[Fflonk Verifier] ${this.name}: Initializing.`);

        this.initialized = true;
    }

    verify(proof) {
        this.checkInitialized();

        logger.info(`[Fflonk Verifier] ${this.name}: Verifying.`);
        return true;

    }
}

module.exports = VerifierA;