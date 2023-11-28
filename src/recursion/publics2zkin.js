
module.exports.publics2zkin = function publics2zkin(subproofId, zkin, globalInfo, publics, isAggregated) {
    let p = 0;
    zkin.sv_circuitType = publics[p++];
    zkin.sv_aggregationTypes = [];
    for(let i = 0; i < globalInfo.aggTypes[subproofId].length; ++i) {
        zkin.sv_aggregationTypes.push(publics[p++]);
    }
    for(let i = 0; i < globalInfo.aggTypes[subproofId].length; ++i) {
        zkin.sv_subAirValues = [publics[p++], publics[p++], publics[p++]];
    }
    zkin.sv_rootC = [publics[p++], publics[p++], publics[p++], publics[p++]];
    for(let i = 0; i < globalInfo.numChallenges.length; ++i) {
        zkin[`sv_root${i+1}`] = [publics[p++], publics[p++], publics[p++], publics[p++]];
    }
    zkin.sv_rootQ = [publics[p++], publics[p++], publics[p++], publics[p++]];
    
    zkin.sv_evalsHash = [publics[p++], publics[p++], publics[p++], publics[p++]];

    for(let i = 0; i < globalInfo.stepsFRI.length - 1; ++i) {
        zkin[`sv_s${i+1}_root`] = [publics[p++], publics[p++], publics[p++], publics[p++]];
    }

    zkin.sv_finalPolHash = [publics[p++], publics[p++], publics[p++], publics[p++]];

    if(!isAggregated) {
        zkin.publics = [];
        for(let i = 0; i < globalInfo.nPublics; ++i) {
            zkin.publics.push(publics[p++]);
        }

        zkin.challenges = [];
        for(let i = 0; i < globalInfo.numChallenges.reduce((nc, acc) => nc + acc, 0) + 4; ++i) {
            zkin.challenges.push([publics[p++], publics[p++], publics[p++]]);
        }

        zkin.challengesFRISteps = [];
        for(let i = 0; i < globalInfo.stepsFRI.length + 1; ++i) {
            zkin.challengesFRISteps.push([publics[p++], publics[p++], publics[p++]]);
        }
    }

    return zkin;
}

module.exports.nullpublics2zkin = function nullpublics2zkin(subproofId, zkin, globalInfo) {
    zkin.sv_circuitType = "0";
    zkin.sv_aggregationTypes = [];
    for(let i = 0; i < globalInfo.aggTypes[subproofId].length; ++i) {
        zkin.sv_aggregationTypes.push(globalInfo.aggTypes[subproofId].aggType);
    }
    zkin.sv_subAirValues = new Array(globalInfo.aggTypes[subproofId].length).fill(["0", "0", "0"]);
    zkin.sv_rootC = ["0", "0", "0", "0"];
    for(let i = 0; i < globalInfo.numChallenges.length; ++i) {
        zkin[`sv_root${i+1}`] = ["0", "0", "0", "0"];
    }
    zkin.sv_rootQ = ["0", "0", "0", "0"];
    zkin.sv_evalsHash = ["0", "0", "0", "0"];
    for(let i = 0; i < globalInfo.stepsFRI.length - 1; ++i) {
        zkin[`sv_s${i+1}_root`] = ["0", "0", "0", "0"];
    }
    zkin.sv_finalPolHash = ["0", "0", "0", "0"];
    return zkin;
}