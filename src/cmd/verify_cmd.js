const CheckerFactory = require("../checker_factory.js");

module.exports = async function verifyCmd(proofManagerConfig, setup, proofs, challenges, challengesFRISteps, options) {
    const checker = await CheckerFactory.createChecker(proofManagerConfig.checker.filename);
    checker.initialize(proofManagerConfig.checker.settings, options);        

    for(const proof of proofs) {    
        const constRoot = setup[proof.subproofId][proof.airId].constRoot;
        const starkInfo = setup[proof.subproofId][proof.airId].starkInfo;

        const isValid = await checker.checkProof(proof, constRoot, starkInfo, challenges, challengesFRISteps, options);
        if(!isValid) return false
    }

    return true;
}