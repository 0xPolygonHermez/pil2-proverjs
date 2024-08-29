const VerifierFactory = require("../verifier_factory.js");

const { fileExists } = require("../setup/utils.js");
const path = require("path");

const log = require("../../logger.js");
const { executeCode } = require("pil2-stark-js/src/stark/stark_verify.js");
const F3g = require("pil2-stark-js/src/helpers/f3g.js");

module.exports = async function verifyCmd(setup, proofs, challenges, publics, options) {
    log.info("[VerifyCmd ]", "==> PROOF VERIFICATION")
    const verifierFilename = path.isAbsolute(setup.config.verifier.filename) ? setup.config.verifier.filename : path.join(__dirname, "..", setup.config.verifier.filename);

    if (!await fileExists(verifierFilename)) {
        log.error(`[${this.name}]`, `Verifier ${verifierFilename} does not exist.`);
        return false;
    }

    const verifier = await VerifierFactory.createVerifier(verifierFilename);
    verifier.initialize(setup.config.verifier.settings, options);        

    let isValid = true;

    if(setup.airoutInfo.globalConstraints !== undefined) {
        const globalConstraints = setup.airoutInfo.globalConstraints;
        
        const F = new F3g();

        log.info("[VerifyCmd ]", "==> VERIFYING GLOBAL CONSTRAINTS")

        const subproofValuesProof = [];
        
        for(let i = 0; i < setup.airoutInfo.subproofs.length; ++i) {
            const spValues = [];
            for(let j = 0; j < setup.airoutInfo.aggTypes[i].length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[i][j].aggType;
                const value = aggType === 0 ? [0n, 0n, 0n] : [1n, 0n, 0n];
                spValues.push(value);
            }
            subproofValuesProof.push(spValues)
        }

        for(let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            const subproofId = proof.subproofId;
            const subproofValues = proof.subproofValues;
            for(let j = 0; j < subproofValues.length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[subproofId][j].aggType;
                                subproofValuesProof[subproofId][j] = aggType === 0
                    ? F.add(subproofValuesProof[subproofId][j], subproofValues[j])
                    : F.mul(subproofValuesProof[subproofId][j], subproofValues[j]);
            }
        }

        for(let i = 0; i < globalConstraints.length; i++) {
            log.info("[VerifyCmd ]", "··· Verifying Global Constraint", i + 1, "/", globalConstraints.length);
            log.info(globalConstraints[i].line);
            const res = executeCode(F, {subproofValues: subproofValuesProof}, globalConstraints[i].code, true);
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

        isValid = isValid && await verifier.checkProof(proof, constRoot, starkInfo, verifierInfo, setup.airoutInfo, challenges, publics, options);
        
        if(!isValid) break;
    }

    const logX = isValid ? log.info : log.error;
    logX("[VerifyCmd ]", "<== PROOF VERIFICATION")

    return isValid;
}