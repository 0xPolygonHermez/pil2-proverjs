const VerifierComponent = require("../../verifier.js");
const log = require('../../../logger.js');

class VerifierA extends VerifierComponent {
    constructor() {
        super("Fflonk Verifier");
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error("[Fflonk Verifier]", `${this.name}: not initialized.`);
            throw new Error(`[Fflonk Verifier] ${this.name}: not initialized.`);
        }
    }

    initialize() {
        log.info("[Fflonk Verifier]", `${this.name}: Initializing.`);

        this.initialized = true;
    }

    verify(proof) {
        this.checkInitialized();

        log.info("[Fflonk Verifier]", `[Fflonk Verifier] ${this.name}: Verifying.`);
        return true;

    }
}

module.exports = VerifierA;