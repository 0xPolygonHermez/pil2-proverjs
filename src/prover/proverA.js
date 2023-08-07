const ProverComponent = require("./prover.js");
const logger = require('../../logger.js');

class ProverA extends ProverComponent {
    constructor() {
        super("Fflonk Prover");
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[Fflonk Prover] ${this.name}: not initialized.`);
        }
    }

    initialize() {
        logger.info("[Fflonk Prover]", `${this.name}: Initializing.`);

        this.initialized = true;
    }

    commitStage(stageId, proof) {
        logger.info("[Fflonk Prover]", `${this.name}: Committing stage ${stageId}.`);

        this.checkInitialized();
    }

    computeQ(proof) {
        logger.info("[Fflonk Prover]", `${this.name}: Computing Q.`);

        this.checkInitialized();
    }

    computeOpenings(proof) {
        logger.info("[Fflonk Prover]", `${this.name}: Computing openings.`);

        this.checkInitialized();
    }

    finalizeProof(proof) {
        logger.info("[Fflonk Prover]", `${this.name}: Finalizing proof.`);

        proof.commitments = [];
        proof.openings = [];
        
        this.checkInitialized();
    }
}

module.exports = ProverA;