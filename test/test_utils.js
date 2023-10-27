const setupCmd = require("../src/cmd/setup_cmd.js");
const proveCmd = require("../src/cmd/prove_cmd.js");
const verifyCmd = require("../src/cmd/verify_cmd.js");
const verifyCircomCmd = require("../src/cmd/verify_circom_cmd.js");
const { assert } = require("chai");
const log = require("../logger.js");

async function executeFullProveTest(proofManagerConfig, publics, options, executeCircom) {
    log.info("[FULLPROVE ]", "==> FULL PROVE TEST")

    const setup = await setupCmd(proofManagerConfig);

    const { proofs, challenges, challengesFRISteps } = await proveCmd(proofManagerConfig, publics, options);

    // console.log("proof");
    // console.log(proofs[0].proof);
    // console.log(proofs[1].proof);
    // console.log("challenges");
    // console.log(challenges);
    // console.log("challengesFRISteps");
    // console.log(challengesFRISteps);
    
    log.info("[FULLPROVE ]", "==> VERIFYING PROOF")
    const isValid = await verifyCmd(proofManagerConfig, setup, proofs, challenges, challengesFRISteps, options);

    assert(isValid == true, "PROOF NOT VALID");
    log.info("[FULLPROVE ]", "<== VERIFYING PROOF")

    if(executeCircom) {
        log.info("[FULLPROVE ]", "==> CIRCOM VERIFICATION")
        //await verifyCircomCmd(proofManagerConfig, setup, proofs, publics);
        log.info("[FULLPROVE ]", "<== CIRCOM VERIFICATION")
    }
    log.info("[FULLPROVE ]", "<== FULL PROVE TEST")
}

async function checkConstraintsTest(proofManagerConfig, publics, options) {
    log.info("[CHECK TEST]", "==> CHECK CONSTRAINTS TEST")

    if(options.onlyCheck === undefined) options.onlyCheck = true;

    const isValid = await proveCmd(proofManagerConfig, publics, options);

    assert(isValid == true, "PROOF CONSTRAINTS UNSUCCESSFULLY FULLFILLED.");
    log.info("[CHECK TEST]", "<== CHECK CONSTRAINTS TEST")
}

module.exports = {
    executeFullProveTest, checkConstraintsTest
};
