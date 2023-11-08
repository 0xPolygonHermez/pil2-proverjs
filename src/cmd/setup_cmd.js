
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { AirOut } = require("../airout.js");
const { newConstantPolsArrayPil2 } = require("pilcom2/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");
const { genFinalSetup } = require("../recursion/generateFinalSetup.js");
const {genRecursiveSetup} = require("../recursion/generateRecursiveSetup.js");
const path = require("path");
const fs = require("fs");

const log = require("../../logger.js");
const { getGlobalConstraintsInfo } = require("pil2-stark-js/src/pil_info/getGlobalConstraintsInfo.js");


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
        "recursive1": {
            "nBits": 11,
            "nBitsExt": 15,
            "nQueries": 32,
            "verificationHashType": "GL",
            "steps": [
                {"nBits": 15},
                {"nBits": 12},
                {"nBits": 9},
                {"nBits": 6}
            ]
        },
        "recursive2": {
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


    if(setupCircom) {
        for(const subproof of airout.subproofs) {
            const constRootsRecursives1 = [];
            const starkInfoRecursives1 = [];
            for(const air of subproof.airs) {
                log.info("[Setup  Cmd]", `··· Computing setup for air '${air.name}'`);
                const {starkInfo: starkInfoRecursive1, constRoot: constRootRecursive1} = await genRecursiveSetup("recursive1", subproof.subproofId, air.airId, setup[subproof.subproofId][air.airId].constRoot, [], setup[subproof.subproofId][air.airId].starkInfo, starkStructs["recursive1"], 18)
            
                constRootsRecursives1[air.airId] = constRootRecursive1;
                starkInfoRecursives1[air.airId] = starkInfoRecursive1;
            }
            
            // TODO: CHECK THAT ALL RECURSIVE1 SIZES ARE THE SAME

            const {starkInfo: starkInfoRecursive2, constRoot: constRootRecursive2} = await genRecursiveSetup("recursive2", subproof.subproofId, undefined, undefined, constRootsRecursives1.map(c => c.constRoot), starkInfoRecursives1[0], starkStructs["recursive2"], 18)

            const {starkInfo: starkInfoRecursiveF, constRoot: constRootRecursiveF} = await genRecursiveSetup("recursivef", subproof.subproofId, undefined, undefined, [constRootRecursive2,...constRootsRecursives1].map(c => c.constRoot), starkInfoRecursive2, starkStructs["recursivef"], 18);
        }

        await genFinalSetup(starkStructFinal, airout.subproofs.length, 18);
    }

    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    return { setup, globalConstraints, config: proofManagerConfig };
}
