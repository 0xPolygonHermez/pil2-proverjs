const logger = require('../../logger.js');

// Abstract base class for all Verifier components
class VerifierComponent {
    constructor(name) {
        this.name = name;
    }

    initialize() {
        throw new Error("Method 'initialize' must be implemented in concrete classes.");
    }

    verify() {
        throw new Error("Method 'verify' must be implemented in concrete classes.");
    }
}

module.exports = VerifierComponent;