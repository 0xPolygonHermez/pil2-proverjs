const { pilCodeGen, buildCode } = require("./codegen");


module.exports.generateExpressionsCode = function generateExpressionsCode(res, symbols, expressions, stark) {
    const expressionsCode = [];
    for(let j = 0; j < expressions.length; ++j) {
        const exp = expressions[j];
        if(!exp.keep && !exp.imPol && ![res.cExpId, res.friExpId].includes(j)) continue;
        const dom = (j === res.cExpId || j === res.friExpId) ? "ext" : "n";
        const ctx = {
            stage: exp.stage,
            calculated: {},
            symbolsUsed: [],
            tmpUsed: 0,
            code: [],
            dom,
            airId: res.airId,
            airgroupId: res.airgroupId,
            stark,
        };

        if(j === res.friExpId) ctx.openingPoints = res.openingPoints;
        if(j === res.cExpId) {
            for(let i = 0; i < symbols.length; i++) {
                if(!symbols[i].imPol) continue;
                const expId = symbols[i].expId;
                ctx.calculated[expId] = {};
                for(let i = 0; i < res.openingPoints.length; ++i) {
                    const openingPoint = res.openingPoints[i];
                    ctx.calculated[expId][openingPoint] = { used: true };
                }
            }
        }
        let exprDest;
        if(exp.imPol) {
            const symbolDest = symbols.find(s => s.expId === j);
            exprDest = { op: "cm", stage: symbolDest.stage, stageId: symbolDest.stageId, id: symbolDest.polId};
        }

        if(exp.symbols) {
            for(let k = 0; k < exp.symbols.length; k++) {
                const symbolUsed = exp.symbols[k];
                if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                    ctx.symbolsUsed.push(symbolUsed);
                };
            }
        }
         

        pilCodeGen(ctx, symbols, expressions, j, 0);
        const code = buildCode(ctx);
        
        if(j == res.cExpId) {
            code.code[code.code.length-1].dest = { type: "q", id: 0, dim: res.qDim };
        }

        if(j == res.friExpId) {
            code.code[code.code.length-1].dest = { type: "f", id: 0, dim: 3 };
        }

        const expInfo = {
            expId: j,
            stage: exp.stage,
            symbols: exp.symbols,
            code,
            dest: exprDest,
            line: exp.line || "",
        }

        expressionsCode.push(expInfo);
    }

    return expressionsCode;
}

module.exports.generateConstraintsDebugCode = function generateConstraintsDebugCode(res, symbols, constraints, expressions, stark) {
    const constraintsCode = [];
    for(let j = 0; j < constraints.length; ++j) {
        const ctx = {
            stage: constraints[j].stage,
            calculated: {},
            symbolsUsed: [],
            tmpUsed: 0,
            code: [],
            dom: "n",
            airId: res.airId,
            airgroupId: res.airgroupId,
            stark,
        };

        const e = expressions[constraints[j].e];
        for(let k = 0; k < e.symbols.length; k++) {
            const symbolUsed = e.symbols[k];
            if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                ctx.symbolsUsed.push(symbolUsed);
            };
        }

        pilCodeGen(ctx, symbols, expressions, constraints[j].e, 0);
        const constraint = buildCode(ctx);
        constraint.boundary = constraints[j].boundary;
        constraint.line = constraints[j].line;
        constraint.imPol = constraints[j].imPol ? 1 : 0;
        constraint.stage = constraints[j].stage === 0 ? 1 : constraints[j].stage;
        if(constraints[j].boundary === "everyFrame") {
            constraint.offsetMin = constraints[j].offsetMin;
            constraint.offsetMax = constraints[j].offsetMax;
        }
        constraintsCode[j] = constraint;
    }
    return constraintsCode;
}

module.exports.generateConstraintPolynomialVerifierCode = function generateConstraintPolynomialVerifierCode(res, verifierInfo, symbols, expressions, stark) {       
    let addMul = stark ? false : true;

    let ctx = {
        stage: res.nStages + 1,
        calculated: {},
        tmpUsed: 0,
        code: [],
        evMap: [],
        dom: "n",
        airId: res.airId,
        airgroupId: res.airgroupId,
        openingPoints: res.openingPoints,
        stark,
        addMul,
        symbolsUsed: [],
        verifierEvaluations: true,
    };

    for(let i = 0; i < symbols.length; i++) {
        if(!symbols[i].imPol) continue;
        const expId = symbols[i].expId;
        ctx.calculated[expId] = {};
        for(let i = 0; i < res.openingPoints.length; ++i) {
            const openingPoint = res.openingPoints[i];
            ctx.calculated[expId][openingPoint] = { cm: true };
        }
    }

    if(expressions[res.cExpId].symbols) {
        for(let k = 0; k < expressions[res.cExpId].symbols.length; k++) {
            const symbolUsed = expressions[res.cExpId].symbols[k];
            if(!ctx.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
                ctx.symbolsUsed.push(symbolUsed);
            };
        }
    }

    pilCodeGen(ctx, symbols, expressions, res.cExpId, 0, true);
    let qIndex = res.cmPolsMap.findIndex(p => p.stage === res.nStages + 1 && p.stageId === 0);
    let openingPos = res.openingPoints.findIndex(p => p === 0);
    for (let i = 0; i < res.qDeg; i++) {
        const rf = { type: "cm", id: qIndex + i, prime: 0, openingPos };
        ctx.evMap.push(rf);
    }

    const typeOrder = { "cm": 0, "const": 1 };
    for(let i = 0; i < res.customCommits.length; ++i) {
        typeOrder[`custom${i}`] = i + 2;
    }
    ctx.evMap.sort((a, b) => {
        const a_type = ["const", "cm"].includes(a.type) ? a.type : `custom${a.commitId}`;
        const b_type = ["const", "cm"].includes(b.type) ? b.type : `custom${b.commitId}`;
        if(typeOrder[a_type] !== typeOrder[b_type]) {
            return typeOrder[b_type] - typeOrder[a_type];
        } else if(a.id !== b.id) {
            return a.id - b.id;
        } else {
            return a.prime - b.prime;
        }
    })

    pilCodeGen(ctx, symbols, expressions, res.cExpId, 0);
    verifierInfo.qVerifier = buildCode(ctx, expressions);
    verifierInfo.qVerifier.line = "";

    res.evMap = ctx.evMap;

    if (!stark) {
        let nOpenings = {};
        for(let i = 0; i < res.evMap.length; ++i) {
            if(res.evMap[i].type === "const") continue;
            const name = res.evMap[i].type + res.evMap[i].id;
            if(!nOpenings[name]) nOpenings[name] = 1;
            ++nOpenings[name];
        }   

        res.maxPolsOpenings = Math.max(...Object.values(nOpenings));

        res.nBitsZK = Math.ceil(Math.log2((res.pilPower + res.maxPolsOpenings) / res.pilPower));
    }
}

module.exports.generateFRIVerifierCode = function generateFRIVerifierCode(res, verifierInfo, symbols, expressions) {
    const ctxExt = {
        stage: res.nStages + 2,
        calculated: {},
        symbolsUsed: [],
        tmpUsed: 0,
        code: [],
        dom: "ext",
        airId: res.airId,
        airgroupId: res.airgroupId,
        openingPoints: res.openingPoints,
        verifierQuery: true,
        addMul: false,
        stark: true,
    };

    for(let k = 0; k < expressions[res.friExpId].symbols.length; k++) {
        const symbolUsed = expressions[res.friExpId].symbols[k];
        if(!ctxExt.symbolsUsed.find(s => s.op === symbolUsed.op && s.stage === symbolUsed.stage && s.id === symbolUsed.id)) {
            ctxExt.symbolsUsed.push(symbolUsed);
        };
    }

    ctxExt.verifierQuery = true;
    ctxExt.addMul = false;
    pilCodeGen(ctxExt, symbols, expressions, res.friExpId, 0);
    verifierInfo.queryVerifier = buildCode(ctxExt);
    verifierInfo.queryVerifier.line = "";
}