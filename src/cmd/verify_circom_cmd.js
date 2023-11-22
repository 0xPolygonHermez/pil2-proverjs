const fs = require("fs");
const pil2circom = require("pil2-stark-js/src/pil2circom");
const { proof2zkin, challenges2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const wasm_tester = require("circom_tester/wasm/tester");

const path = require("path");

const log = require("../../logger.js");

module.exports = async function verifyCircomCmd(setup, proofs, challenges, challengesFRISteps) {
    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
    
    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);

    let verifierFilename;
    
    for(const proof of proofs) {
        log.info(`[CircomVrfr]`, `--> CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        try {
            const constRoot = setup.setup[proof.subproofId][proof.airId].constRoot;
            const starkInfo = setup.setup[proof.subproofId][proof.airId].starkInfo;

            verifierFilename = path.join(tmpPath, "basic_stark_verifier_" + setup.config.name + "_subproof" + proof.subproofId + "_airId" + proof.airId + ".circom");
            const verifierCircomTemplate = await pil2circom(constRoot, starkInfo, { hashCommits: true, vadcop: true });
            await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

            const circuit = await wasm_tester(verifierFilename, { O:1, prime: "goldilocks", include: "node_modules/pil2-stark-js/circuits.gl", verbose: true });

            let input = proof2zkin(proof.proof, starkInfo);
            input = challenges2zkin({challenges, challengesFRISteps}, starkInfo, input);
            input.publics = proof.publics;

            await circuit.calculateWitness(input, true);

            log.info(`[CircomVrfr]`, `<-- CIRCOM verification (subproofId ${proof.subproofId} airId ${proof.airId})`);

        } catch (error) {
            log.error(`[CircomVrfr]`, `Error while verifying proof (subproofId ${proof.subproofId} airId ${proof.airId}):`);
            log.error(`[CircomVrfr]`, `${error}`);
            throw error;
        } finally {
            await fs.promises.unlink(verifierFilename);
        }
    }

    log.info("[CircomVrfr]", "==> CIRCOM PROOF VERIFICATION")
}