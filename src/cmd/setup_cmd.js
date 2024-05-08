
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { AirOut } = require("../airout.js");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { generateFixedCols } = require("pil2-stark-js/src/witness/witnessCalculator.js");
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
const { log2 } = require("pilcom/src/utils.js");

// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const airout = new AirOut(proofManagerConfig.airout.airoutFilename);

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil2: true,
    };

    let aggTypes = [];
    for(const subproof of airout.subproofs) {
        aggTypes[subproof.subproofId] = subproof.subproofvalues;
    }

    let stepsFRI = new Set([]);
    for(let i = 0; i < Object.keys(proofManagerConfig.prover.settings).length; i++) {
        const key = Object.keys(proofManagerConfig.prover.settings)[i];
        const filename = proofManagerConfig.prover.settings[key].starkStruct;
        const starkStructFilename = filename.startsWith('/') ? filename : path.join(__dirname, "../../", filename);
        const starkStruct = require(starkStructFilename);
        starkStruct.steps.map(step => step.nBits).forEach(e => stepsFRI.add(e));
    }

    stepsFRI = Array.from(stepsFRI).sort((a, b) => b - a).map(s => { return { nBits: s }});

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
        
            const filename = settings.starkStruct;
            const starkStructFilename = filename.startsWith('/') ? filename : path.join(__dirname, "../../", filename);
            const starkStruct = require(starkStructFilename);
            
            const fixedPols = generateFixedCols(air.symbols, air.numRows)
            getFixedPolsPil2(air, fixedPols, setupOptions.F);
            
            /***** THIS IS JUST FOR DEBUGGING PURPOSES, EXAMPLE BASIC_VADCOP *****/
            if(fixedPols.$$defArray[0].name === "Main.L1") {
                fixedPols.$$array[0] = fixedPols.$$array[3];
                fixedPols.$$array[2] = fixedPols.$$array[3];
            }
            /********************************************************************/
            setup[subproof.subproofId][air.airId] = await starkSetup(fixedPols, air, starkStruct, setupOptions);
        }
    }

    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    if(proofManagerConfig.aggregation && proofManagerConfig.aggregation.genProof) {
        const starkStructFinalFilename = path.join(__dirname, "../../", proofManagerConfig.aggregation.settings.final.starkStruct);
        const starkStructFinal = require(starkStructFinalFilename);
        
        const starkStructRecursiveFilename = path.join(__dirname, "../../", proofManagerConfig.aggregation.settings.recursive.starkStruct);
        const starkStructRecursive = require(starkStructRecursiveFilename);

        for(const subproof of airout.subproofs) {
            const constRootsRecursives1 = [];
            const starkInfoRecursives1 = [];
            const verifierInfoRecursives1 = [];
            const pilRecursives1 = [];

            for(const air of subproof.airs) {
                log.info(
                    "[Setup  Cmd]",
                    `··· Computing setup for air '${air.name}'`
                );

                log.info(
                    "[Setup  Cmd]",
                    `······ Checking if air '${air.name}' needs a compressor`
                );

                let verifierCircomTemplate = await pil2circom(
                    setup[subproof.subproofId][air.airId].constRoot,
                    setup[subproof.subproofId][air.airId].starkInfo,
                    setup[subproof.subproofId][air.airId].verifierInfo,
                    { skipMain: true }
                );
                verifierCircomTemplate +=
                    `\n\ncomponent main = StarkVerifier${subproof.subproofId}();\n\n`;
                const nameTmp = await tmpName();
                const folder = path.dirname(nameTmp);
                const tmpCircomFilename = nameTmp + ".circom";
                const tmpR1csFilename = nameTmp + ".r1cs";

                await fs.promises.writeFile(
                    tmpCircomFilename,
                    verifierCircomTemplate,
                    "utf8"
                );

                const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks -l node_modules/pil2-stark-js/circuits.gl ${tmpCircomFilename} -o ${folder}`;
                console.log(compileRecursiveCommand);
                await exec(compileRecursiveCommand);

                const tmpR1cs = await readR1cs(tmpR1csFilename, {F: setupOptions.F});

                const { NUsed } = getCompressorConstraints(
                    setupOptions.F,
                    tmpR1cs,
                    18
                );

                let nBits = log2(NUsed - 1) + 1;

                await fs.promises.unlink(tmpR1csFilename);
                await fs.promises.unlink(tmpCircomFilename);

                let constRoot;
                let starkInfo;
                setup[subproof.subproofId][air.airId].hasCompressor = false;
                if (nBits !== 17) {
                    // TODO: Iterate over different possibilities here
                    const starkStructCompressor = {
                        nBits,
                        nBitsExt: nBits + 4,
                        nQueries: nBits < 15 ? 64 : 32,
                        hashCommits: true,
                        verificationHashType: "GL",
                        steps: [{ nBits: nBits + 4 }],
                    };
                    let friStepBits = nBits + 4;
                    while (friStepBits > 5) {
                        friStepBits = Math.max(friStepBits - 4, 5);
                        starkStructCompressor.steps.push({
                            nBits: friStepBits,
                        });
                    }
                    const {
                        starkInfo: starkInfoRecursiveCompressor,
                        verifierInfo: verifierInfoRecursiveCompressor,
                        constRoot: constRootRecursiveCompressor,
                    } = await genRecursiveSetup(
                        "compressor",
                        subproof.subproofId,
                        air.airId,
                        setup[subproof.subproofId][air.airId].constRoot,
                        [],
                        setup[subproof.subproofId][air.airId].starkInfo,
                        setup[subproof.subproofId][air.airId].verifierInfo,
                        starkStructCompressor,
                        18
                    );

                    constRoot = constRootRecursiveCompressor.constRoot;
                    starkInfo = starkInfoRecursiveCompressor;
                    verifierInfo = verifierInfoRecursiveCompressor;
                    setup[subproof.subproofId][air.airId].hasCompressor = true;
                } else {
                    constRoot = setup[subproof.subproofId][air.airId].constRoot;
                    starkInfo = setup[subproof.subproofId][air.airId].starkInfo;
                    verifierInfo = setup[subproof.subproofId][air.airId].verifierInfo;
                }

                const starkStructRecursive1 = { ...starkStructRecursive};
                if(!setup[subproof.subproofId][air.airId].hasCompressor) {
                    starkStructRecursive1.hashCommits = true;
                }

                const {
                    starkInfo: starkInfoRecursive1,
                    constRoot: constRootRecursive1,
                    verifierInfo: verifierInfoRecursive1,
                    pil: pilRecursive1,
                } = await genRecursiveSetup(
                    "recursive1",
                    subproof.subproofId,
                    air.airId,
                    constRoot,
                    [],
                    starkInfo,
                    verifierInfo,
                    starkStructRecursive,
                    18,
                    setup[subproof.subproofId][air.airId].hasCompressor,
                );

                constRootsRecursives1[air.airId] = constRootRecursive1;
                starkInfoRecursives1[air.airId] = starkInfoRecursive1;
                verifierInfoRecursives1[air.airId] = verifierInfoRecursive1;
                pilRecursives1[air.airId] = pilRecursive1;
            }
            
            const hashPilRecursive1 = crypto.createHash("sha256").update(JSON.stringify(pilRecursives1[0])).digest("hex");
            for(let i = 1; i < subproof.airs.length; i++) {
                const hash = crypto.createHash("sha256").update(JSON.stringify(pilRecursives1[i])).digest("hex");
                if(hashPilRecursive1 !== hash) throw new Error("All recursive1 pil must be the same");
            }

            const {starkInfo: starkInfoRecursive2, constRoot: constRootRecursive2, pil: pilRecursive2 } = await genRecursiveSetup("recursive2", subproof.subproofId, undefined, undefined, constRootsRecursives1.map(c => c.constRoot), starkInfoRecursives1[0], verifierInfoRecursives1[0], starkStructRecursive, 18)


            const hashPilRecursive2 = crypto.createHash("sha256").update(JSON.stringify(pilRecursive2)).digest("hex");

            if(hashPilRecursive1 !== hashPilRecursive2) throw new Error("Recursive1 and recursive2 pil must be the same");

            const nullProof = genNullProof(starkInfoRecursive2);            
            await fs.promises.writeFile(`tmp/subproof${subproof.subproofId}_null.proof.zkin.json`, JSON.stringify(nullProof, 0, 1), "utf8");
        }

        await genFinalSetup(starkStructFinal, globalConstraints, airout.subproofs.length, 18);
    } else {
        for(const subproof of airout.subproofs) {
            for(const air of subproof.airs) {
                if(fs.existsSync(`tmp/compressor_subproof${subproof.subproofId}_air${air.airId}.verifier.circom`)) {
                    setup[subproof.subproofId][air.airId].hasCompressor = true;
                }
            }
        }
    }

    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    return { setup, stepsFRI, globalConstraints, config: proofManagerConfig };
}
