
const pilInfo = require("./pil_info/pil_info.js");

module.exports.starkSetup = async function starkSetup(pil, starkStruct, options) {
    
    const pil2 = options.pil2 || false;
    
    const {pilInfo: starkInfo, expressionsInfo, verifierInfo, stats} = await pilInfo(pil, pil2, starkStruct, options);

    const res = {
        starkInfo,
        expressionsInfo,
        verifierInfo,
        stats,
    }
    
    return res;
}
