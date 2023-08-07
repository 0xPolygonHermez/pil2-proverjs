const VerifierA = require("./verifierA.js");

const log = require("../logger.js");

class VerifierFactory {
    static createVerifier(type) {
        switch (type) {
            case "verifierA":
                return new VerifierA();
            default:
                log.error("[VerifierFactory]", "Invalid Verifier type");
                throw new Error("Invalid Verifier type");
        }
    }
}

module.exports = VerifierFactory;