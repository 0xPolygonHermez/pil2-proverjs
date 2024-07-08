const setupCmd = require("../src/cmd/setup_cmd.js");
const proveCmd = require("../src/cmd/prove_cmd.js");
const verifyCmd = require("../src/cmd/verify_cmd.js");
const verifyCircomCmd = require("../src/cmd/verify_circom_cmd.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true, storeAsString: true });
const { assert } = require("chai");
const fs = require("fs");
const log = require("../logger.js");
const { proof2zkin } = require("stark-recurser/src/pil2circom/proof2zkin.js");
const path = require("path");

async function generateSetupTest(proofManagerConfig) {
    log.info("[GENERATESETUP ]", "==> GENERATE SETUP TEST")

    const setup = await setupCmd(proofManagerConfig);

    log.info("[GENERATESETUP ]", "<== GENERATE SETUP TEST")

    return setup;
}

async function executeFullProveTest(setup, publics, options, genCircomProof) {
    log.info("[FullProve ]", "==> FULL PROVE TEST")

    const { proofs, challenges, challengesFRISteps, subproofValues } = await proveCmd(setup, publics, options);
        
    const tmpPath =  path.join(__dirname, "..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

    for(const proof of proofs) {
        let proofZkinFilename = path.join(tmpPath, "basic_stark_subproof" + proof.subproofId + "_air" + proof.airId + ".proof.zkin.json");

        const zkin = proof2zkin(proof.proof, setup.setup[proof.subproofId][proof.airId].starkInfo);
        zkin.publics = proof.publics;
        zkin.challenges = challenges.flat();
        zkin.challengesFRISteps = challengesFRISteps;

        await fs.promises.writeFile(proofZkinFilename, JSONbig.stringify(zkin, (k, v) => {
            if (typeof(v) === "bigint") {
                return v.toString();
            } else {
                return v;
            }
        }, 1), "utf8");
    }
    
    const isValid = await verifyCmd(setup, proofs, challenges, challengesFRISteps, subproofValues, options);

    assert(isValid == true, "PROOF NOT VALID");

    if(genCircomProof) await verifyCircomCmd(setup, proofs, challenges, challengesFRISteps);

    log.info("[FullProve ]", "<== FULL PROVE TEST")
}

async function checkConstraintsTest(setup, publics, options) {
    log.info("[CHECK TEST]", "==> CHECK CONSTRAINTS TEST")

    if(options.onlyCheck === undefined) options.onlyCheck = true;

    const isValid = await proveCmd(setup, publics, options);

    assert(isValid == true, "PROOF CONSTRAINTS UNSUCCESSFULLY FULLFILLED.");
    
    log.info("[CHECK TEST]", "<== CHECK CONSTRAINTS TEST")
}

module.exports = {
    generateSetupTest, executeFullProveTest, checkConstraintsTest
};
