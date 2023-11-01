
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { AirOut } = require("../airout.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");

const path = require("path");

const log = require("../../logger.js");
const { getGlobalConstraintsInfo } = require("pil2-stark-js/src/pil_info/getGlobalConstraintsInfo.js");


// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const airout = new AirOut(proofManagerConfig.airout.airoutFilename);

    const setupOptions = {
        F: new F3g("0xFFFFFFFF00000001"),
        pil1: false,
    };

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

        if(airout.constraints !== undefined) {
            globalConstraints = getGlobalConstraintsInfo(airout, true);
        }
    }

    return { setup, globalConstraints, config: proofManagerConfig };
}