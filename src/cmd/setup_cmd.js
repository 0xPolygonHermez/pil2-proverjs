
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { AirOut } = require("../airout.js");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { newConstantPolsArrayPil2 } = require("pilcom2/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");
const { genNullProof } = require("pil2-stark-js/src/proof2zkin.js");
const { genFinalSetup } = require("../recursion/generateFinalSetup.js");
const {genRecursiveSetup} = require("../recursion/generateRecursiveSetup.js");
const path = require("path");
const crypto = require('crypto');
const fs = require("fs");
const {tmpName} = require("tmp-promise");

const log = require("../../logger.js");
const { getGlobalConstraintsInfo } = require("pil2-stark-js/src/pil_info/getGlobalConstraintsInfo.js");
const { getCompressorConstraints } = require("pil2-stark-js/src/compressor/compressor_constraints.js");
const { readR1cs } = require("r1csfile");
const pil2circom = require("pil2-stark-js/src/pil2circom.js");


// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const setupCircom = false;

    const airout = new AirOut(proofManagerConfig.airout.airoutFilename);

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil1: false,
    };

    let aggTypes = [];
    for(const subproof of airout.subproofs) {
        aggTypes[subproof.subproofId] = subproof.subproofvalues;
    }

    //THIS IS ADHOC FOR FIBONACCI VADCOP EXAMPLE !!
    const stepsFRI =  [{"nBits": 5},{"nBits": 4},{"nBits": 2}];

    const globalInfo = {
        nPublics: airout.numPublicValues,
        numChallenges: airout.numChallenges,
        stepsFRI: stepsFRI,
        aggTypes,
    }

    const tmpPath =  path.join(__dirname, "../..", "tmp");
    if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);


    let globalInfoFilename = path.join(tmpPath, "globalInfo.json");
    await fs.promises.writeFile(globalInfoFilename, JSON.stringify(globalInfo, null, 1), "utf8");

    let setup = [];
    let globalConstraints;

    for(const subproof of airout.subproofs) {
        setup[subproof.subproofId] = [];
        for(const air of subproof.airs) {
            log.info("[Setup  Cmd]", `··· Computing setup for air '${air.name}'`);

            let settings = proofManagerConfig.prover.settings[air.name] || proofManagerConfig.prover.settings.default;
            
            if (!settings) {
                log.error(`[${this.name}]`, `No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
                throw new Error(`[${this.name}] No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
            }
        
            const starkStructFilename =  path.join(__dirname, "../../", settings.starkStruct);
            const starkStruct = require(starkStructFilename);
            
            const fixedPols = newConstantPolsArrayPil2(air.symbols, air.numRows, setupOptions.F)
            getFixedPolsPil2(air, fixedPols, setupOptions.F);

            
            setup[subproof.subproofId][air.airId] = await starkSetup(fixedPols, air, starkStruct, setupOptions);
        }
    }

    // TODO: This should be part of the config
    const starkStructFinal = {
        "nBits": 17,
        "nBitsExt": 21,
        "nQueries": 32,
        "verificationHashType": "GL",
        "steps": [
            {"nBits": 21},
            {"nBits": 17},
            {"nBits": 13},
            {"nBits": 9},
            {"nBits": 5}
        ]
    }

    const starkStructs = {
        "recursive": {
            "nBits": 17,
            "nBitsExt": 20,
            "nQueries": 43,
            "verificationHashType": "GL",
            "steps": [
                {"nBits": 20},
                {"nBits": 16},
                {"nBits": 12},
                {"nBits": 9},
                {"nBits": 6}
            ]
        },
        "recursivef": {
            "nBits": 16,
            "nBitsExt": 20,
            "nQueries": 32,
            "verificationHashType": "GL",
            "steps": [
                {"nBits": 20},
                {"nBits": 16},
                {"nBits": 12},
                {"nBits": 9},
                {"nBits": 6}
            ]
        }
    }


    if(true) {
        for(const subproof of airout.subproofs) {
            const constRootsRecursives1 = [];
            const starkInfoRecursives1 = [];
            const pilRecursives1 = [];

            for(const air of subproof.airs) {
                log.info("[Setup  Cmd]", `··· Computing setup for air '${air.name}'`);

                log.info("[Setup  Cmd]", `······ Checking if air '${air.name}' needs a compressor`);
                let verifierCircomTemplate = await pil2circom(setup[subproof.subproofId][air.airId].constRoot, setup[subproof.subproofId][air.airId].starkInfo, {skipMain: true});
                verifierCircomTemplate += "\n\ncomponent main = StarkVerifier();\n\n";
                const nameTmp = await tmpName();
                const tmpVerifierName = nameTmp + ".circom";
                await fs.promises.writeFile(tmpVerifierName, verifierCircomTemplate, "utf8");

                const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks -l node_modules/pil2-stark-js/circuits.gl ${tmpVerifierName} -o tmp`;
                await exec(compileRecursiveCommand);
                const tmpR1csFile = `./${nameTmp}.r1cs`;
                const tmpR1cs = await readR1cs(tmpR1csFile, {F: setupOptions.F});

                const { NUsed } = getCompressorConstraints(setupOptions.F, tmpR1cs, 18);

                let nBits = log2(NUsed - 1) + 1;

                await fs.promises.unlink(tmpR1csFile);
                await fs.promises.unlink(tmpVerifierName);

                let constRoot;
                let starkInfo;
                let hasCompressor = false;
                if(nBits !== 17) {
                    // TODO: Iterate over different possibilities here
                    const starkStructCompressor = {
                        nBits,
                        nBitsExt: nBits + 4,
                        nQueries: nBits < 15 ? 64 : 32,
                        verificationHashType: "GL",
                        steps: [{nBits: nBits + 4}]
                    }
                    let friStepBits = nBits + 4;
                    while(friStepBits > 5) {
                        friStepBits = Math.max(friStepBits - 4, 5);
                        starkStructCompressor.steps.push({nBits: friStepBits});
                    }
                    const {starkInfo: starkInfoRecursiveCompressor, constRoot: constRootRecursiveCompressor} = await genRecursiveSetup("compressor", subproof.subproofId, air.airId, setup[subproof.subproofId][air.airId].constRoot, [], setup[subproof.subproofId][air.airId].starkInfo, starkStructCompressor, 18)
                    
                    constRoot = constRootRecursiveCompressor.constRoot;
                    starkInfo = starkInfoRecursiveCompressor;
                    hasCompressor = true;
                } else {
                    constRoot = setup[subproof.subproofId][air.airId].constRoot;
                    starkInfo = setup[subproof.subproofId][air.airId].starkInfo;
                }
                const {starkInfo: starkInfoRecursive1, constRoot: constRootRecursive1, pil: pilRecursive1 } = await genRecursiveSetup("recursive1", subproof.subproofId, air.airId, constRoot, [], starkInfo, starkStructs["recursive"], 18, hasCompressor);
            
                constRootsRecursives1[air.airId] = constRootRecursive1;
                starkInfoRecursives1[air.airId] = starkInfoRecursive1;
                pilRecursives1[air.airId] = pilRecursive1;
            }
            
            const hashPilRecursive1 = crypto.createHash("sha256").update(JSON.stringify(pilRecursives1[0])).digest("hex");
            for(let i = 1; i < subproof.airs.length; i++) {
                const hash = crypto.createHash("sha256").update(JSON.stringify(pilRecursives1[i])).digest("hex");
                if(hashPilRecursive1 !== hash) throw new Error("All recursive1 pil must be the same");
            }

            const {starkInfo: starkInfoRecursive2, constRoot: constRootRecursive2, pil: pilRecursive2 } = await genRecursiveSetup("recursive2", subproof.subproofId, undefined, undefined, constRootsRecursives1.map(c => c.constRoot), starkInfoRecursives1[0], starkStructs["recursive"], 18)


            const hashPilRecursive2 = crypto.createHash("sha256").update(JSON.stringify(pilRecursive2)).digest("hex");

            if(hashPilRecursive1 !== hashPilRecursive2) throw new Error("Recursive1 and recursive2 pil must be the same");

            const nullProof = genNullProof(starkInfoRecursive2);            
            await fs.promises.writeFile(`tmp/subproof${subproof.subproofId}_null.proof.zkin.json`, nullProof, "utf8");

            const {starkInfo: starkInfoRecursiveF, constRoot: constRootRecursiveF} = await genRecursiveSetup("recursivef", subproof.subproofId, undefined, undefined, [constRootRecursive2,...constRootsRecursives1].map(c => c.constRoot), starkInfoRecursive2, starkStructs["recursivef"], 18);
        }

        await genFinalSetup(starkStructFinal, airout.subproofs.length, 18);
    }

    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    return { setup, globalConstraints, config: proofManagerConfig };
}
