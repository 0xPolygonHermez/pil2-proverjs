const fs =require("fs");
const { getGlobalConstraintsInfo } = require("../pil2-stark/pil_info/getGlobalConstraintsInfo");

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


async function setAiroutInfo(airout, starkStructs) {
    let vadcopInfo = {};

    vadcopInfo.name = airout.name;

    vadcopInfo.airs = [];
    vadcopInfo.air_groups = [];
    
    vadcopInfo.aggTypes = [];
    for(let i = 0; i < airout.airGroups.length; ++i) {
        const airgroup = airout.airGroups[i];
        const airgroupId = airgroup.airgroupId;
        vadcopInfo.aggTypes[airgroupId] = airgroup.airGroupValues || [];
        vadcopInfo.air_groups.push(airgroup.name);
        vadcopInfo.airs[i] = [];
        for(let j = 0; j < airgroup.airs.length; ++j) {
            vadcopInfo.airs[airgroupId][j] = {name: `${airgroup.airs[j].name}`, num_rows: airgroup.airs[j].numRows};
        }
    }

    let finalStep = starkStructs[0].steps[starkStructs[0].steps.length - 1].nBits;

    let stepsFRI = new Set([]);
    for(let i = 0; i < starkStructs.length; i++) {
        const starkStruct = starkStructs[i];
        starkStruct.steps.map(step => step.nBits).forEach(e => stepsFRI.add(e));
        if(starkStruct.steps[starkStruct.steps.length - 1].nBits !== finalStep) throw new Error("All FRI steps for different airgroups needs to end at the same nBits");
    }

    vadcopInfo.stepsFRI = Array.from(stepsFRI).sort((a, b) => b - a).map(s => { return { nBits: s }});
    vadcopInfo.nPublics = airout.numPublicValues;
    vadcopInfo.numChallenges = airout.numChallenges || [0];

    vadcopInfo.numProofValues = airout.numProofValues;

    let proofValues = airout.getProofValues();
    vadcopInfo.proofValuesMap = proofValues.map(p => { return {name: p.name, id: p.id }})

    let globalConstraints = [];
    if(airout.constraints !== undefined) {
        globalConstraints = getGlobalConstraintsInfo(airout, true);
    }

    return { vadcopInfo, globalConstraints };
}

module.exports = {
    fileExists,
    generateStarkStruct,
    setAiroutInfo,
}
