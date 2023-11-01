const setupCmd = require("../src/cmd/setup_cmd.js");
const proveCmd = require("../src/cmd/prove_cmd.js");
const verifyCmd = require("../src/cmd/verify_cmd.js");
const verifyCircomCmd = require("../src/cmd/verify_circom_cmd.js");
const { assert } = require("chai");
const log = require("../logger.js");

async function generateSetupTest(proofManagerConfig) {
    log.info("[GENERATESETUP ]", "==> GENERATE SETUP TEST")

    const setup = await setupCmd(proofManagerConfig);

    log.info("[GENERATESETUP ]", "<== GENERATE SETUP TEST")

    return setup;
}

async function executeFullProveTest(setup, publics, options, executeCircom) {
    log.info("[FULLPROVE ]", "==> FULL PROVE TEST")

    const { proofs, challenges, challengesFRISteps, subproofValues } = await proveCmd(setup, publics, options);
    
    const isValid = await verifyCmd(setup, proofs, challenges, challengesFRISteps, subproofValues, options);

    assert(isValid == true, "PROOF NOT VALID");

    if(executeCircom) await verifyCircomCmd(setup, proofs, challenges, challengesFRISteps);

    log.info("[FULLPROVE ]", "<== FULL PROVE TEST")
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
