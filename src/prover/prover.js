const logger = require('../../logger.js');

// Abstract base class for all Prover components
class ProverComponent {
    constructor(name) {
        this.name = name;
    }

    initialize() {
        throw new Error("Method 'initialize' must be implemented in concrete classes.");
    }

    commitStage(stageId) {
        throw new Error("Method 'commitStage' must be implemented in concrete classes.");
    }

    computeQ() {
        throw new Error("Method 'computeQ' must be implemented in concrete classes.");
    }

    computeOpenings() {
        throw new Error("Method 'computeOpenings' must be implemented in concrete classes.");
    }

    finalizeProof() {
        throw new Error("Method 'finalizeProof' must be implemented in concrete classes.");
    }
}

module.exports = ProverComponent;