const VerifierFactory = require("../verifier_factory.js");

const { fileExists } = require("../utils.js");
const path = require("path");

const log = require("../../logger.js");
const { executeCode } = require("pil2-stark-js/src/stark/stark_verify.js");
const F3g = require("pil2-stark-js/src/helpers/f3g.js");

module.exports = async function verifyCmd(proofManagerConfig, setup, proofs, challenges, challengesFRISteps, subproofValues, options) {
    log.info("[VERIFYCMD ]", "==> PROOF VERIFICATION")
    const verifierFilename =  path.join(__dirname, "../..", proofManagerConfig.verifier.filename);

    if (!await fileExists(verifierFilename)) {
        log.error(`[${this.name}]`, `Verifier ${verifierFilename} does not exist.`);
        return false;
    }

    const verifier = await VerifierFactory.createVerifier(verifierFilename);
    verifier.initialize(proofManagerConfig.verifier.settings, options);        

    let isValid = true;

    if(setup[proofs.length] !== undefined) {
        const globalConstraints = setup[proofs.length].globalConstraints;
        
        const F = new F3g();

        log.info("[VERIFYCMD ]", "==> VERIFYING GLOBAL CONSTRAINTS")

        for(let i = 0; i < globalConstraints.length; i++) {
            const res = executeCode(F, {subproofValues}, globalConstraints[i].code, true);
            if(!F.isZero(res)) isValid = false;

            if(!isValid) break;
        }
    }

    for(const proof of proofs) {    
        const constRoot = setup[proof.subproofId][proof.airId].constRoot;
        const starkInfo = setup[proof.subproofId][proof.airId].starkInfo;

        isValid = isValid && await verifier.checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps, options);
        
        if(!isValid) break;
    }

    const logX = isValid ? log.info : log.error;
    logX("[VERIFYCMD ]", "<== PROOF VERIFICATION")

    return isValid;
}