const fs = require("fs");
const pil2circom = require("pil2-stark-js/src/pil2circom");
const { proof2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const wasm_tester = require("circom_tester/wasm/tester");

const path = require("path");

const log = require("../../logger.js");

module.exports = async function verifyCircomCmd(proofManagerConfig, setup, proofs, output) {
    log.info("[FULLPROVE ]", "==> CIRCOM VERIFICATION")
    
    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
    const verifierFilename = path.join(tmpPath, "basic_stark_verifier_" + proofManagerConfig.name + ".circom");

    // TODO REMOVE
    const constRoot = setup[0][0].constRoot;
    const starkInfo = setup[0][0].starkInfo;
    
    const verifierCircomTemplate = await pil2circom(constRoot, starkInfo, { hashCommits: true });
    await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

    for(const proof of proofs) {
        try {
            const circuit = await wasm_tester(verifierFilename, { O:1, prime: "goldilocks", include: "node_modules/pil2-stark-js/circuits.gl", verbose: true });

            const input = proof2zkin(proof.proof, starkInfo);
            input.publics = proof.publics;

            //const witness = await circuit.calculateWitness(input, true);

            // TODO change this to check all outputs
            //await circuit.assertOut(witness, output);
        } catch (error) {
            log.error(`[${this.name}]`, `Error while verifying proof: ${error}`);
            throw error;
        } finally {
            await fs.promises.unlink(verifierFilename);
        }
    }

    log.info("[FULLPROVE ]", "<== CIRCOM VERIFICATION")
}