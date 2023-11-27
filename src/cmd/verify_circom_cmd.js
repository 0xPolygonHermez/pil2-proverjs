const fs = require("fs");
const { proof2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const path = require("path");

const log = require("../../logger.js");
const { generateProof } = require("../recursion/generateProof.js");

module.exports = async function verifyCircomCmd(setup, proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

    let verifierFilename;
    
    const proofsBySubproofId = [];

    for(const proof of proofs) {
        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        try {
            const starkInfo = setup.setup[proof.subproofId][proof.airId].starkInfo;
            const hasCompressor = setup.setup[proof.subproofId][proof.airId].hasCompressor;

            let inputs = proof2zkin(proof.proof, starkInfo);
            inputs.challenges = challenges.flat();
            inputs.challengesFRISteps = challengesFRISteps;
            inputs.publics = proof.publics;

            if(hasCompressor) {
                const {zkin: zkinCompressor} = await generateProof("compressor", proof.subproofId, proof.airId, inputs, hasCompressor);
                inputs = zkinCompressor;
            } else {
                const verkeyRecursive2 = JSONbig.parse(await fs.promises.readFile(`tmp/recursive2_subproof${subproofId}.verkey.json`, "utf8"));
                inputs.rootCRecursive2 = verkeyRecursive2.constRoot;
            }
  
            const {zkin: zkinRecursive1} = await generateProof("recursive1", proof.subproofId, proof.airId, inputs, hasCompressor);

            if(!proofsBySubproofId[proof.subproofId]) proofsBySubproofId[proof.subproofId] = [];
            proofsBySubproofId[proof.subproofId] = zkinRecursive1;
            
            // verifierFilename = path.join(tmpPath, "basic_stark_verifier_" + setup.config.name + "_subproof" + proof.subproofId + "_airId" + proof.airId + ".circom");
            // const verifierCircomTemplate = await pil2circom(constRoot, starkInfo, { hashCommits: true, vadcop: true });
            // await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

            // const circuit = await wasm_tester(verifierFilename, { O:1, prime: "goldilocks", include: "node_modules/pil2-stark-js/circuits.gl", verbose: true });

            // let input = proof2zkin(proof.proof, starkInfo);
            // input = challenges2zkin({challenges, challengesFRISteps}, starkInfo, input);
            // input.publics = proof.publics;

            // await circuit.calculateWitness(input, true);

            // log.info(`[CircomVrfr]`, `<-- CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        } catch (error) {
            log.error(`[CircomVrfr]`, `Error while verifying proof (subproofId ${proof.subproofId} airId ${proof.airId}):`);
            log.error(`[CircomVrfr]`, `${error}`);
            throw error;
        } finally {
            await fs.promises.unlink(verifierFilename);
        }
    }

    console.log(proofsBySubproofId);

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}