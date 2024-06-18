const VerifierFactory = require("../verifier_factory.js");

const { fileExists } = require("../utils.js");
const path = require("path");

const log = require("../../logger.js");
const { executeCode } = require("pil2-stark-js/src/stark/stark_verify.js");
const F3g = require("pil2-stark-js/src/helpers/f3g.js");

module.exports = async function verifyCmd(setup, proofs, challenges, challengesFRISteps, subproofValues, options) {
    log.info("[VerifyCmd ]", "==> PROOF VERIFICATION")
    const verifierFilename =  path.join(__dirname, "../..", setup.config.verifier.filename);

    if (!await fileExists(verifierFilename)) {
        log.error(`[${this.name}]`, `Verifier ${verifierFilename} does not exist.`);
        return false;
    }

    const verifier = await VerifierFactory.createVerifier(verifierFilename);
    verifier.initialize(setup.config.verifier.settings, options);        

    let isValid = true;

    if(setup.globalConstraints !== undefined) {
        const globalConstraints = setup.globalConstraints;
        
        const F = new F3g();

        log.info("[VerifyCmd ]", "==> VERIFYING GLOBAL CONSTRAINTS")

        for(let i = 0; i < globalConstraints.length; i++) {
            log.info("[VerifyCmd ]", "··· Verifying Global Constraint", i + 1, "/", globalConstraints.length);
            const res = executeCode(F, {subproofValues}, globalConstraints[i].code, true);
            isValid = isValid && F.isZero(res);

            if(!isValid) {
                log.error("[VerifyCmd ]", "Global Constraint", i + 1, "failed.");
                return isValid;
            }
        }

        log.info("[VerifyCmd ]", "<== VERIFYING GLOBAL CONSTRAINTS")
    }

    for(const proof of proofs) {    
        const constRoot = setup.setup[proof.subproofId][proof.airId].constRoot;
        const starkInfo = setup.setup[proof.subproofId][proof.airId].starkInfo;
        const verifierInfo = setup.setup[proof.subproofId][proof.airId].verifierInfo;

        isValid = isValid && await verifier.checkProof(proof, constRoot, starkInfo, verifierInfo, setup.stepsFRI, challenges, challengesFRISteps, options);
        
        if(!isValid) break;
    }

    const logX = isValid ? log.info : log.error;
    logX("[VerifyCmd ]", "<== PROOF VERIFICATION")

    return isValid;
}