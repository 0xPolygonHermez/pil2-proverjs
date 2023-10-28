const VerifierFactory = require("../verifier_factory.js");

const { fileExists } = require("../utils.js");
const path = require("path");

const log = require("../../logger.js");

module.exports = async function verifyCmd(proofManagerConfig, setup, proofs, challenges, challengesFRISteps, options) {
    log.info("[VERIFYCMD ]", "==> VERIFYING PROOF")
    const verifierFilename =  path.join(__dirname, "../..", proofManagerConfig.verifier.filename);

    if (!await fileExists(verifierFilename)) {
        log.error(`[${this.name}]`, `Verifier ${verifierFilename} does not exist.`);
        return false;
    }

    const verifier = await VerifierFactory.createVerifier(verifierFilename);
    verifier.initialize(proofManagerConfig.verifier.settings, options);        

    let isValid = true;
    for(const proof of proofs) {    
        const constRoot = setup[proof.subproofId][proof.airId].constRoot;
        const starkInfo = setup[proof.subproofId][proof.airId].starkInfo;

        isValid = isValid && await verifier.checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps, options);
        
        if(!isValid) break;
    }

    const logX = isValid ? log.info : log.error;
    logX("[VERIFYCMD ]", "<== VERIFYING PROOF")

    return isValid;
}