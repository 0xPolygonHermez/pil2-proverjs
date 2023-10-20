const setupCmd = require("../src/cmd/setup_cmd.js");
const proveCmd = require("../src/cmd/prove_cmd.js");
const verifyCmd = require("../src/cmd/verify_cmd.js");
const verifyCircomCmd = require("../src/cmd/verify_circom_cmd.js");
const { assert } = require("chai");

async function proveAndVerifyTest(proofManagerConfig, publics) {
    const options = { verify: true, parallelExec: false, useThreads: false };

    const setup = await setupCmd(proofManagerConfig);

    const proof = await proveCmd(proofManagerConfig, publics, options);

    const isValid = await verifyCmd(proofManagerConfig, setup, proof, options);

    assert(isValid == true, "Proof is not valid");

    await verifyCircomCmd(proofManagerConfig, setup, proof, publics);
}

module.exports = {
    proveAndVerifyTest
};
