
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { PilOut } = require("../pilout.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");

const path = require("path");

const log = require("../../logger.js");

// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const piloutObj = new PilOut(proofManagerConfig.pilout.piloutFilename, proofManagerConfig.pilout.piloutProto);
    const pilout = piloutObj.pilout;

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil1: false,
    };

    let setup = [];
    for( let i = 0; i < pilout.subproofs.length; i++) {
        setup[i] = [];
        for( let j = 0; j < pilout.subproofs[i].airs.length; j++) {
            const air = pilout.subproofs[i].airs[j];
            air.symbols = pilout.symbols;
            air.hints = pilout.hints;
            air.numChallenges = pilout.numChallenges;

            let settings =
                proofManagerConfig.prover.settings[air.name]?.[air.numRows] ||
                proofManagerConfig.prover.settings[air.name]?.default ||
                proofManagerConfig.prover.settings.default;
            
            if (!settings) {
                log.error(`[${this.name}]`, `No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
                throw new Error(`[${this.name}] No settings for air '${air.name}'${air.numRows ? ` with N=${air.numRows}` : ''}`);
            }
        
            const starkStructFilename =  path.join(__dirname, "../../", settings.starkStruct);
            const starkStruct = require(starkStructFilename);

            const airSymbols = pilout.symbols.filter(symbol => symbol.subproofId === i && symbol.airId === j);

            const fixedPols = newConstantPolsArrayPil2(airSymbols, air.numRows, setupOptions.F)
            getFixedPolsPil2(air, fixedPols, setupOptions.F);

            setup[i][j] = await starkSetup(fixedPols, air, starkStruct, setupOptions)
        }
    }

    return setup;
}