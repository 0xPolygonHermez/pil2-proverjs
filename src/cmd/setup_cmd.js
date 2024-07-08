
const { AirOut } = require("../airout.js");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { generateFixedCols } = require("pil2-stark-js/src/witness/witnessCalculator.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { starkSetup } = require("pil2-stark-js");
const { getGlobalConstraintsInfo } = require("pil2-stark-js/src/pil_info/getGlobalConstraintsInfo.js");
const { genFinalSetup } = require("../recursion/generateFinalSetup.js");
const {genRecursiveSetup} = require("../recursion/generateRecursiveSetup.js");
const path = require("path");
const crypto = require('crypto');
const fs = require("fs");
const {tmpName} = require("tmp-promise");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const log = require("../../logger.js");
const pil2circom = require("stark-recurser/src/pil2circom/pil2circom.js");
const { generateStarkStruct } = require("../utils.js");
const { isCompressorNeeded } = require("stark-recurser/src/vadcop/is_compressor_needed.js");
const { log2 } = require("stark-recurser/src/utils/utils.js");

async function setAiroutInfo(airout, starkStructs) {
    let vadcopInfo = {};

    vadcopInfo.name = airout.name;

    vadcopInfo.airs = [];
    vadcopInfo.subproofs = [];
    
    vadcopInfo.aggTypes = [];
    for(let i = 0; i < airout.subproofs.length; ++i) {
        const subproof = airout.subproofs[i];
        const subproofId = subproof.subproofId;
        vadcopInfo.aggTypes[subproofId] = subproof.subproofvalues;
        vadcopInfo.subproofs.push(subproof.name);
        vadcopInfo.airs[i] = [];
        for(let j = 0; j < subproof.airs.length; ++j) {
            vadcopInfo.airs[subproofId][j] = {name: `${subproof.name}_${j}`};
        }
    }

    let stepsFRI = new Set([]);
    for(let i = 0; i < starkStructs.length; i++) {
        const starkStruct = starkStructs[i];
        starkStruct.steps.map(step => step.nBits).forEach(e => stepsFRI.add(e));
    }

    vadcopInfo.stepsFRI = Array.from(stepsFRI).sort((a, b) => b - a).map(s => { return { nBits: s }});
    vadcopInfo.nPublics = airout.numPublicValues;
    vadcopInfo.numChallenges = airout.numChallenges;


    let globalConstraints = [];
    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    return { vadcopInfo, globalConstraints };
}


// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const airout = new AirOut(proofManagerConfig.airout.airoutFilename);

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil2: true,
    };

    let setup = [];

    let starkStructs = [];

    for(const subproof of airout.subproofs) {
        setup[subproof.subproofId] = [];
        for(const air of subproof.airs) {
            log.info("[Setup  Cmd]", `··· Computing setup for air '${air.name}'`);

            let settings = proofManagerConfig.prover.settings[air.name + "_" + Math.log2(air.numRows)] || proofManagerConfig.prover.settings.default;
            
            if (!settings) {
                log.error(`[${this.name}]`, `No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
                throw new Error(`[${this.name}] No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
            }
        
            let starkStruct;
            const filename = settings.starkStruct;
            if(filename) {
                const starkStructFilename = path.isAbsolute(filename) ? filename : path.join(__dirname, "../../", filename);
                starkStruct = require(starkStructFilename);
            } else {
                starkStruct = generateStarkStruct(settings, log2(air.numRows));
            }

            starkStructs.push(starkStruct);
            
            const fixedPols = generateFixedCols(air.symbols, air.numRows)
            getFixedPolsPil2(air, fixedPols, setupOptions.F);
            
            setup[subproof.subproofId][air.airId] = await starkSetup(fixedPols, air, starkStruct, setupOptions);

            const filesDir = `tmp/config/${airout.name}/${subproof.name}/airs/${subproof.name}_${air.airId}/air`;
            await fs.promises.mkdir(filesDir, { recursive: true });

            const MH = await buildMerkleHashGL(starkStruct.splitLinearHash);

            await MH.writeToFile(setup[subproof.subproofId][air.airId].constTree, `${filesDir}/${subproof.name}_${air.airId}.consttree`);

            await fs.promises.writeFile(`${filesDir}/${subproof.name}_${air.airId}.verkey.json`, JSONbig.stringify(setup[subproof.subproofId][air.airId].constRoot, null, 1), "utf8");

            await fs.promises.writeFile(`${filesDir}/${subproof.name}_${air.airId}.starkinfo.json`, JSON.stringify(setup[subproof.subproofId][air.airId].starkInfo, null, 1), "utf8");
        
            await fs.promises.writeFile(`${filesDir}/${subproof.name}_${air.airId}.verifierinfo.json`, JSON.stringify(setup[subproof.subproofId][air.airId].verifierInfo, null, 1), "utf8");
        
            await fs.promises.writeFile(`${filesDir}/${subproof.name}_${air.airId}.expressionsinfo.json`, JSON.stringify(setup[subproof.subproofId][air.airId].expressionsInfo, null, 1), "utf8");
        }
    }

    let globalInfo;
    
    if(proofManagerConfig.aggregation && proofManagerConfig.aggregation.genSetup) {
        const airoutInfo = await setAiroutInfo(airout, starkStructs);
        let globalConstraints = airoutInfo.globalConstraints;
        globalInfo = airoutInfo.vadcopInfo;
        
        const recursiveSettings = proofManagerConfig.aggregation.settings.recursive || proofManagerConfig.aggregation.settings.default || {};

        let starkStructRecursive;
        if(recursiveSettings.starkStruct) {
            const starkStructRecursiveFilename = path.isAbsolute(recursiveSettings.starkStruct) ? recursiveSettings.starkStruct : path.join(__dirname, "../../", recursiveSettings.starkStruct);
            starkStructRecursive = require(starkStructRecursiveFilename);
        } else {
            starkStructRecursive = generateStarkStruct(recursiveSettings, 17);
        }

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

                log.info(
                    "[Setup  Cmd]",
                    `······ Checking if air '${air.name}' needs a compressor`
                );

                const compressorNeeded = await isCompressorNeeded(tmpR1csFilename, {})
              
                await fs.promises.unlink(tmpR1csFilename);
                await fs.promises.unlink(tmpCircomFilename);

                let constRoot;
                let starkInfo;
                let verifierInfo;

                const starkStructRecursive1 = { ...starkStructRecursive};
                
                if(compressorNeeded.hasCompressor) {
                    setup[subproof.subproofId][air.airId].hasCompressor = true;
                    globalInfo.airs[subproof.subproofId][air.airId].hasCompressor = true;

                    const starkStructSettings = {};
                    starkStructSettings.blowupFactor = 4;
                    if(compressorNeeded.nBits <= 15) starkStructSettings.nQueries = 64;

                    const starkStructCompressor = generateStarkStruct(starkStructSettings, compressorNeeded.nBits);
                    
                    const recursiveSetup = await genRecursiveSetup(
                        "compressor",
                        subproof.name,
                        subproof.subproofId,
                        air.airId,
                        globalInfo,
                        setup[subproof.subproofId][air.airId].constRoot,
                        [],
                        setup[subproof.subproofId][air.airId].starkInfo,
                        setup[subproof.subproofId][air.airId].verifierInfo,
                        starkStructCompressor,
                        18
                    );
                    
                    constRoot = recursiveSetup.constRoot;
                    starkInfo = recursiveSetup.starkInfo;
                    verifierInfo = recursiveSetup.verifierInfo;
                } else {
                    constRoot = setup[subproof.subproofId][air.airId].constRoot;
                    starkInfo = setup[subproof.subproofId][air.airId].starkInfo;
                    verifierInfo = setup[subproof.subproofId][air.airId].verifierInfo;
                    starkStructRecursive1.hashCommits = true;
                }

                const {
                    starkInfo: starkInfoRecursive1,
                    constRoot: constRootRecursive1,
                    verifierInfo: verifierInfoRecursive1,
                    pil: pilRecursive1,
                } = await genRecursiveSetup(
                    "recursive1",
                    subproof.name,
                    subproof.subproofId,
                    air.airId,
                    globalInfo,
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

            const { pil: pilRecursive2 } = await genRecursiveSetup(
                "recursive2", 
                subproof.name,
                subproof.subproofId,
                undefined,
                globalInfo,
                [],
                constRootsRecursives1,
                starkInfoRecursives1[0], 
                verifierInfoRecursives1[0], 
                starkStructRecursive, 18)

            const hashPilRecursive2 = crypto.createHash("sha256").update(JSON.stringify(pilRecursive2)).digest("hex");

            if(hashPilRecursive1 !== hashPilRecursive2) throw new Error("Recursive1 and recursive2 pil must be the same");
        }

        const finalSettings = proofManagerConfig.aggregation.settings.final || proofManagerConfig.aggregation.settings.default;

        let starkStructFinal;
        if(finalSettings.starkStruct) {
            const starkStructFinalFilename = path.isAbsolute(finalSettings.starkStruct) ? finalSettings.starkStruct : path.join(__dirname, "../../", finalSettings.starkStruct);
            starkStructFinal = require(starkStructFinalFilename);
        } else {
            starkStructFinal = generateStarkStruct(finalSettings, log2(N));
        }

        await fs.promises.writeFile("tmp/config/airout.globalInfo.json", JSON.stringify(globalInfo, null, 1), "utf8");

        await fs.promises.writeFile("tmp/config/airout.globalConstraints.json", JSON.stringify(globalConstraints, null, 1), "utf8");

        await genFinalSetup(starkStructFinal, 18);
    }

    if(!globalInfo) {
        const airoutInfo = await setAiroutInfo(airout, starkStructs);
        globalInfo = airoutInfo.vadcopInfo;
    }
    return { setup, airoutInfo: globalInfo, config: proofManagerConfig };
}
