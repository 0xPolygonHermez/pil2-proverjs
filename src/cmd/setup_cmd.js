
const F3g = require("pil2-stark-js/src/helpers/f3g");
const { PilOut } = require("../pilout.js");
const { newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");
const { getFixedPolsPil2 } = require("pil2-stark-js/src/pil_info/helpers/pil2/piloutInfo.js");
const starkSetup = require("pil2-stark-js/src/stark/stark_setup");

const path = require("path");

// NOTE: by the moment this is a STARK setup process, it should be a generic setup process?
module.exports = async function setupCmd(proofManagerConfig) {
    const piloutObj = new PilOut(proofManagerConfig.pilout.piloutFilename, proofManagerConfig.pilout.piloutProto);
    const pilout = piloutObj.pilout;

    const starkStructFilename =  path.join(__dirname, "../../", proofManagerConfig.prover.settings.starkStruct);
    const starkStruct = require(starkStructFilename);

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

            const airSymbols = pilout.symbols.filter(symbol => symbol.subproofId === i && symbol.airId === j);

            const cnstPols = newConstantPolsArrayPil2(airSymbols, air.numRows, setupOptions.F)
            getFixedPolsPil2(air, cnstPols, setupOptions.F);

            setup[i][j] = await starkSetup(cnstPols, air, starkStruct, setupOptions)
        }
    }

    return setup;
}