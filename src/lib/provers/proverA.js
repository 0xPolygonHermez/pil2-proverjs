const ProverComponent = require("../../prover.js");
const log = require('../../../logger.js');

class ProverA extends ProverComponent {
    constructor(proofManagerAPI) {
        super("Fflonk Prover", proofManagerAPI);
        this.initialized = false;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[Fflonk Prover] ${this.name}: not initialized.`);
        }
    }

    initialize() {
        log.info("[Fflonk Prover]", `${this.name}: Initializing.`);

        this.initialized = true;
    }

    commitStage(stageId, proof) {
        log.info("[Fflonk Prover]", `${this.name}: Committing stage ${stageId}.`);

        this.checkInitialized();
    }

    computeQ(proof) {
        log.info("[Fflonk Prover]", `${this.name}: Computing Q.`);

        this.checkInitialized();
    }

    computeOpenings(proof) {
        log.info("[Fflonk Prover]", `${this.name}: Computing openings.`);

        this.checkInitialized();
    }

    finalizeProof(proof) {
        log.info("[Fflonk Prover]", `${this.name}: Finalizing proof.`);

        proof.commitments = [];
        proof.openings = [];
        
        this.checkInitialized();
    }
}

module.exports = ProverA;