const setupCmd = require("../src/cmd/setup_cmd.js");
const proveCmd = require("../src/cmd/prove_cmd.js");
const verifyCmd = require("../src/cmd/verify_cmd.js");
const verifyCircomCmd = require("../src/cmd/verify_circom_cmd.js");
const { assert } = require("chai");

async function proveAndVerifyTest(proofManagerConfig, publics, options) {
    const setup = await setupCmd(proofManagerConfig);

    const { proofs, challenges, challengesFRISteps } = await proveCmd(proofManagerConfig, publics, options);

    // console.log("proof");
    // console.log(proofs);
    // console.log("challenges");
    // console.log(challenges);
    // console.log("challengesFRISteps");
    // console.log(challengesFRISteps);
    
    const isValid = await verifyCmd(proofManagerConfig, setup, proofs, challenges, challengesFRISteps, options);

    assert(isValid == true, "Proof is not valid");

    await verifyCircomCmd(proofManagerConfig, setup, proofs, publics);
}

module.exports = {
    proveAndVerifyTest
};
