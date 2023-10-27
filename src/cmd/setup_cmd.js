
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { AirOut } = require("../airout.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");

const path = require("path");

const log = require("../../logger.js");

// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const airoutObj = new AirOut(proofManagerConfig.airout.airoutFilename, proofManagerConfig.airout.airoutProto);
    const airout = airoutObj.airout;

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil1: false,
    };

    let setup = [];
    for( let i = 0; i < airout.subproofs.length; i++) {
        setup[i] = [];
        for( let j = 0; j < airout.subproofs[i].airs.length; j++) {
            log.info("[Setup  Cmd]", `Setup for air '${airout.subproofs[i].airs[j].name}'`);
            const air = airout.subproofs[i].airs[j];
            air.symbols = airout.symbols;
            air.hints = airout.hints;
            air.numChallenges = airout.numChallenges;
            air.subproofId = i;
            air.airId = j;

            let settings =
                proofManagerConfig.prover.settings[air.name] ||
                // proofManagerConfig.prover.settings[air.name]?.default ||
                proofManagerConfig.prover.settings.default;
            
            if (!settings) {
                log.error(`[${this.name}]`, `No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
                throw new Error(`[${this.name}] No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
            }
        
            const starkStructFilename =  path.join(__dirname, "../../", settings.starkStruct);
            const starkStruct = require(starkStructFilename);

            const airSymbols = airoutObj.getSymbolsBySubproofIdAirId(i, j);
            
            const fixedPols = newConstantPolsArrayPil2(airSymbols, air.numRows, setupOptions.F)
            getFixedPolsPil2(air, fixedPols, setupOptions.F);

            
            setup[i][j] = await starkSetup(fixedPols, air, starkStruct, setupOptions);
        }
    }

    return setup;
}