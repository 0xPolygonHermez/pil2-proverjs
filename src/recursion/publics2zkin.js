
module.exports.publics2zkin = async function publics2zkin(subproofId, zkin, globalInfo, publics, constRootCRecursive2) {
    let p = 0;
    zkin.sv_circuitType = publics[p++];
    zkin.sv_aggregationTypes = publics[p++];
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

    if(constRootCRecursive2) {
        zkin.rootCRecursive2 = constRootCRecursive2;
    }

    return zkin;
}