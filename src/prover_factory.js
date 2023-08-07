const ProverA = require("./lib/provers/proverA.js");

const log = require("../logger.js");

class ProverFactory {
    static createProver(type) {
        switch (type) {
            case "proverA":
                return new ProverA();
            default:
                log.error("[ProverFactory]", "Invalid Prover type");
                throw new Error("Invalid Prover type");
        }
    }
}

module.exports = ProverFactory;