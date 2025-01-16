const path = require("path");
const { formatExpressions, formatConstraints, formatSymbols, formatHints, buf2bint } = require("./utils");

module.exports.getPiloutInfo = function getPiloutInfo(res, pilout) {
    res.airId = pilout.airId;
    res.airgroupId = pilout.airgroupId;
    
    const constraints = formatConstraints(pilout);
    
    let saveSymbols = pilout.symbols ? false : true;
    let expressions, symbols;
    if(!saveSymbols) {
        const e = formatExpressions(pilout);
        expressions = e.expressions;
        symbols = formatSymbols(pilout);
    } else {
        const e = formatExpressions(pilout, true);
        expressions = e.expressions;
        symbols = e.symbols;
    }

    symbols = symbols.filter(s => !["witness", "fixed"].includes(s.type) || s.airId === res.airId && s.airgroupId === res.airgroupId);

    const airGroupValues = pilout.airGroupValues || [];
    res.pilPower = Math.log2(pilout.numRows);
    res.nCommitments = symbols.filter(s => s.type === "witness" && s.airId === res.airId && s.airgroupId === res.airgroupId).length;
    res.nConstants = symbols.filter(s => s.type === "fixed" && s.airId === res.airId && s.airgroupId === res.airgroupId).length;
    res.nPublics = symbols.filter(s => s.type === "public").length;
    res.airGroupValues = airGroupValues;
    if(pilout.numChallenges) {
        res.nStages = pilout.numChallenges.length;
    } else {
        const numChallenges = symbols.length > 0 ? new Array(Math.max(...symbols.map(s => s.stage || 0))).fill(0) : [];
        res.nStages = numChallenges.length;
    }
    
    const airHints = pilout.hints?.filter(h => h.airId === res.airId && h.airGroupId === res.airgroupId) || [];
    const hints = formatHints(pilout, airHints, symbols, expressions, saveSymbols);

    res.customCommits = pilout.customCommits || [];
    res.customCommitsMap = [];
    for(let i = 0; i < res.customCommits.length; ++i) {
        res.customCommitsMap[i] = [];
        for(let j = 0; j < res.customCommits[i].stageWidths.length; ++j) {
            if(res.customCommits[i].stageWidths[j] > 0) {
                res.mapSectionsN[res.customCommits[i].name + j] = 0;
            }
        }
    }

    return {expressions, hints, constraints, symbols};
}

module.exports.getFixedPolsPil2 = async function getFixedPolsPil2(filesDir, pil, cnstPols) {        
    for(let i = 0; i < cnstPols.$$defArray.length; ++i) {
        const def = cnstPols.$$defArray[i];
        const id = def.id;
        const deg = def.polDeg;
        const fixedCols = pil.fixedCols[i];
        for(let j = 0; j < deg; ++j) {
            const constPol = cnstPols[id];
            constPol[j] = buf2bint(fixedCols.values[j]);
        }
    }
    await cnstPols.saveToFile(path.join(filesDir, `${pil.name}.const`));
}
    