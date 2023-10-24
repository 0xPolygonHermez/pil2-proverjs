const CheckerFactory = require("../checker_factory.js");

module.exports = async function verifyCmd(proofManagerConfig, setup, proof, challenges, challengesFRISteps, options) {
    const checker = await CheckerFactory.createChecker(proofManagerConfig.checker.filename);
    checker.initialize(proofManagerConfig.checker.settings, options);        

    // TODO REMOVE
    const constRoot = setup[0][0].constRoot;
    const starkInfo = setup[0][0].starkInfo;

    return await checker.checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps);
}