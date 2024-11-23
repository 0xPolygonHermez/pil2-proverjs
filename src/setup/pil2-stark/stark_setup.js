
const pilInfo = require("./pil_info/pil_info.js");
const F3g = require("./utils/f3g.js");

module.exports.starkSetup = async function starkSetup(pil, starkStruct, options) {

    const F = new F3g("0xFFFFFFFF00000001");
    
    const pil2 = options.pil2 || false;
    
    const {pilInfo: starkInfo, expressionsInfo, verifierInfo, stats} = await pilInfo(F, pil, pil2, starkStruct, options);

    const res = {
        starkInfo,
        expressionsInfo,
        verifierInfo,
        stats,
    }
    
    return res;
}
