const ProverA = require("./proverA.js");

const logger = require("../../logger.js");

class ProverFactory {
    static createProver(type) {
        switch (type) {
            case "proverA":
                return new ProverA();
            default:
                logger.error("[ProverFactory]", "Invalid Prover type");
                throw new Error("Invalid Prover type");
        }
    }
}

module.exports = ProverFactory;