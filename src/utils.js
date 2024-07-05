const fs =require("fs");
const { log2 } = require("pil2-compiler/src/utils");

async function fileExists(path) {
    return fs.promises.access(path, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
}


function generateStarkStruct(settings, nBits) {
    let starkStruct = {
        nBits,
        verificationHashType: "GL",
    };

    let hashCommits = settings.hashCommits || true;
    let blowupFactor = settings.blowupFactor || 1;
    let nQueries = Math.ceil(128 / blowupFactor);
    if(settings.nQueries > nQueries) nQueries = settings.nQueries;
    let foldingFactor = settings.foldingFactor || 4;
    let finalDegree = settings.finalDegree || 5;
    
    starkStruct.hashCommits = hashCommits;
    starkStruct.nBitsExt = starkStruct.nBits + blowupFactor;
    starkStruct.nQueries = nQueries;
    
    starkStruct.steps = [{nBits: starkStruct.nBitsExt}];
    let friStepBits = starkStruct.nBitsExt;
    while (friStepBits > finalDegree) {
        friStepBits = Math.max(friStepBits - foldingFactor, finalDegree);
        starkStruct.steps.push({
            nBits: friStepBits,
        });
    }

    return starkStruct;
}

module.exports = {
    fileExists,
    generateStarkStruct,
}
