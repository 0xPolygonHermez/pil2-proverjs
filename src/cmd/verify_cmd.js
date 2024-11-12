const VerifierFactory = require("../verifier_factory.js");

const { fileExists } = require("../setup/utils.js");
const path = require("path");

const log = require("../../logger.js");
const { executeCode } = require("pil2-stark-js/src/stark/stark_verify.js");
const F3g = require("pil2-stark-js/src/helpers/f3g.js");
const FRI = require("pil2-stark-js/src/stark/fri.js");

module.exports = async function verifyCmd(setup, proofs, challenges, publics, proofValues, options) {
    log.info("[VerifyCmd ]", "==> PROOF VERIFICATION")
    const verifierFilename = path.isAbsolute(setup.config.verifier.filename) ? setup.config.verifier.filename : path.join(__dirname, "../..", setup.config.verifier.filename);

    if (!await fileExists(verifierFilename)) {
        log.error(`[${this.name}]`, `Verifier ${verifierFilename} does not exist.`);
        return false;
    }

    const verifier = await VerifierFactory.createVerifier(verifierFilename);
    verifier.initialize(setup.config.verifier.settings, options);        

    let isValid = true;

    const globalConstraints = setup.airoutInfo.globalConstraints.constraints;
    if(globalConstraints !== undefined && globalConstraints.length > 0) {
        
        const F = new F3g();

        log.info("[VerifyCmd ]", "==> VERIFYING GLOBAL CONSTRAINTS")

        const airgroupValuesProof = [];
        
        for(let i = 0; i < setup.airoutInfo.air_groups.length; ++i) {
            const spValues = [];
            for(let j = 0; j < setup.airoutInfo.aggTypes[i].length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[i][j].aggType;
                const value = aggType === 0 ? [0n, 0n, 0n] : [1n, 0n, 0n];
                spValues.push(value);
            }
            airgroupValuesProof.push(spValues)
        }

        for(let i = 0; i < proofs.length; i++) {
            const proof = proofs[i];
            const airgroupId = proof.airgroupId;
            const airgroupValues = proof.airgroupValues;
            for(let j = 0; j < airgroupValues.length; ++j) {
                const aggType = setup.airoutInfo.aggTypes[airgroupId][j].aggType;
                    airgroupValuesProof[airgroupId][j] = aggType === 0
                    ? F.add(airgroupValuesProof[airgroupId][j], airgroupValues[j])
                    : F.mul(airgroupValuesProof[airgroupId][j], airgroupValues[j]);
            }
        }

        for(let i = 0; i < globalConstraints.length; i++) {
            log.info("[VerifyCmd ]", "··· Verifying Global Constraint", i + 1, "/", globalConstraints.length);
            log.info(globalConstraints[i].line);
            const res = executeCode(F, {airgroupValues: airgroupValuesProof, publics, proofValues, challenges: challenges.challenges}, globalConstraints[i].code, true);
            isValid = isValid && F.isZero(res);

            if(!isValid) {
                log.error("[VerifyCmd ]", "Global Constraint", i + 1, "failed.");
            }
        }

        log.info("[VerifyCmd ]", "<== VERIFYING GLOBAL CONSTRAINTS")
    }

    let index = 0;
    let accQueryVals = new Array(setup.airoutInfo.stepsFRI.length).fill(new Array(setup.airoutInfo.nQueries).fill([0n, 0n, 0n]));
    for(const proof of proofs) {    
        const constRoot = setup.setup[proof.airgroupId][proof.airId].constRoot;
        const starkInfo = setup.setup[proof.airgroupId][proof.airId].starkInfo;
        const verifierInfo = setup.setup[proof.airgroupId][proof.airId].verifierInfo;

        let resV = await verifier.checkProof(proof, constRoot, starkInfo, verifierInfo, setup.airoutInfo, challenges, publics, proofValues, options);
        
        if(!resV.validProof) log.error("[VerifyCmd ]", "Proof verification ", index, " failed.");
        
        if(options.multiFRI) {
            for(let i = 0; i < setup.airoutInfo.nQueries; ++i) {
                accQueryVals[i] = F.add(accQueryVals[i],resV.queryVals[i]); // TODO: CHALLENGE
            }
        }

        isValid = isValid && resV.validProof;

        ++index;
    }

    // TODO: CHECK FRI

    if(options.multiFRI) {
        const fri = new FRI( setup.airoutInfo.nQueries, setup.airoutInfo.stepsFRI, MH, logger );

        if(logger) logger.debug("Verifying queries");
        if(starkInfo.starkStruct.steps.length == 1) {
            if(!fri.verifyStepFRI(0, ctx.friQueries, queryVals, proof.fri[0])) return false;
        } else {
            if(!fri.verifyStepFRI(0, ctx.friQueries, queryVals, proof.fri[0].polQueries.map(p => p[0]))) return false;
        }
        
        if(!fri.verifyMH(ctx.friQueries, proof.fri)) return false;
        
        for (let si=1; si< starkInfo.starkStruct.steps.length; si++) {
            let nextVals = fri.computeNextStepFRI(si, ctx.challengesFRISteps,ctx.friQueries, proof.fri);
            
            if (si < starkInfo.starkStruct.steps.length - 1) {
                if(!fri.verifyStepFRI(si, ctx.friQueries, nextVals, proof.fri[si].polQueries.map(p => p[0]))) return false;
            } else {
                if(!fri.verifyStepFRI(si, ctx.friQueries, nextVals, proof.fri[si])) return false;
            }
        }
    }

    if(!fri.verifyFinalPol(proof.fri[starkInfo.starkStruct.steps.length - 1])) return false;   

    const logX = isValid ? log.info : log.error;
    logX("[VerifyCmd ]", "<== PROOF VERIFICATION")

    return isValid;
}