const ProverComponent = require("../../prover.js");
const log = require('../../../logger.js');

class ProverFri extends ProverComponent {
    constructor(proofmanagerAPI) {
        super("FRI Prover", proofmanagerAPI);
    }

    setup() {
        super.initialize();
    }

    commitStage(stageId, proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `Committing stage ${stageId}.`);
    }

    prove(proof) {
        this.checkInitialized();

        // TODO Compute Intermediate Polynomials

        this.computeQ(proof);

        this.computeOpenings(proof);

        this.FRICommitPhase(proof);

        this.FRIQueryPhase(proof);

        proof.commitments = [];
        proof.openings = [];
    }

    computeQ(proof) {
        log.info(`[${this.name}]`, "Computing Q.");
    }

    computeOpenings(proof) {
        log.info(`[${this.name}]`, "Computing Openings.");
    }

    FRICommitPhase(proof) {
        log.info(`[${this.name}]`, "FRI Commit Phase.");
    }

    FRIQueryPhase(proof) {        
        log.info(`[${this.name}]`, "FRI Query Phase.");
    }
}

module.exports = ProverFri;