const ProverComponent = require("./prover.js");
const logger = require('../../logger.js');

class ProverA extends ProverComponent {
    constructor() {
        super("Fflonk Prover");
    }

    initialize() {
        logger.info(`[Fflonk Prover] ${this.name}: Initializing.`);
    }

    commitStage(stageId, proof) {
        logger.info(`[Fflonk Prover] ${this.name}: Committing stage ${stageId}.`);
    }

    computeQ(proof) {
        logger.info(`[Fflonk Prover] ${this.name}: Computing Q.`);
    }

    computeOpenings(proof) {
        logger.info(`[Fflonk Prover] ${this.name}: Computing openings.`);
    }

    finalizeProof(proof) {
        logger.info(`[Fflonk Prover] ${this.name}: Finalizing proof.`);
    }
}

module.exports = ProverA;