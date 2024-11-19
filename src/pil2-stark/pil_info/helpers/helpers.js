module.exports.getExpDim = function getExpDim(expressions, expId, stark) {

    return _getExpDim(expressions[expId]);

    function _getExpDim(exp) {
        if(typeof(exp.dim) !== "undefined") {
            return exp.dim; 
        } else if(["add", "sub", "mul", "muladd"].includes(exp.op)) {
            return Math.max(...exp.values.map(v => _getExpDim(v)));
        } else if (exp.op === "exp") {
            exp.dim = _getExpDim(expressions[exp.id]);
            return exp.dim;
        } else if (exp.op === "cm" || exp.op === "custom") {
            return exp.dim || 1;
        } else if (["const", "number", "public", "x", "Zi"].includes(exp.op)) {
            return 1;
        } else if (["challenge", "eval", "xDivXSubXi"].includes(exp.op)) {
            return stark ? 3 : 1;
        } else throw new Error("Exp op not defined: " + exp.op);
    }
}

module.exports.addInfoExpressions = function addInfoExpressions(expressions, exp, stark) {
    if("expDeg" in exp) return;

    if("next" in exp) {
        exp.rowOffset = exp.next ? 1 : 0;
        delete exp.next;
    }

    if (exp.op == "exp") {
        addInfoExpressions(expressions, expressions[exp.id], stark);
        exp.expDeg = expressions[exp.id].expDeg;
        exp.rowsOffsets = expressions[exp.id].rowsOffsets;
        if(!exp.dim) exp.dim = expressions[exp.id].dim;
        if(!exp.stage) exp.stage = expressions[exp.id].stage;

        if(["cm", "const", "custom"].includes(expressions[exp.id].op)) {
            exp = expressions[exp.id];
        }

    } else if (["x", "cm", "custom", "const"].includes(exp.op) || (exp.op === "Zi" && exp.boundary !== "everyRow")) {
        exp.expDeg = 1;
        if(!exp.stage || exp.op === "const") exp.stage = exp.op === "cm" ? 1 : 0;
        if(!exp.dim) exp.dim = 1; 

        if("rowOffset" in exp) {
            exp.rowsOffsets = [exp.rowOffset];
        }
    } else if(exp.op === "xDivXSubXi") {
        exp.expDeg = 1;
    } else if (["challenge", "eval"].includes(exp.op)) {
        exp.expDeg = 0;
        exp.dim = stark ? 3 : 1;
    } else if(exp.op === "airgroupvalue" || exp.op === "proofvalue") {
        exp.expDeg = 0;
        exp.dim = 3;
    } else if (exp.op === "airvalue") {
        exp.expDeg = 0;
        if(!exp.dim) exp.dim = exp.stage != 1 && stark ? 3 : 1; 
    } else if (exp.op === "public") {
        exp.expDeg = 0;
        exp.stage = 1; 
        if(!exp.dim) exp.dim = 1;
    } else if (exp.op === "number" || (exp.op === "Zi" && exp.boundary === "everyRow")) {
        exp.expDeg = 0;
        exp.stage = 0; 
        if(!exp.dim) exp.dim = 1;
    } else if(["add", "sub", "mul", "neg"].includes(exp.op)) {
        if(exp.op === "neg") {
            exp.op = "mul";
            exp.values = [{op: "number", value: "-1", expDeg: 0, stage: 0, dim: 1}, exp.values[0]];
        }
        const lhsValue = exp.values[0];
        const rhsValue = exp.values[1];
        if(["add"].includes(exp.op) && lhsValue.op === "number" && BigInt(lhsValue.value) === 0n) {
            exp.op = "mul";
            lhsValue.value = "1";
        }
        if(["add", "sub"].includes(exp.op) && rhsValue.op === "number" && BigInt(rhsValue.value) === 0n) {
            exp.op = "mul";
            rhsValue.value = "1";
        }
        addInfoExpressions(expressions, lhsValue, stark);
        addInfoExpressions(expressions, rhsValue, stark);

        const lhsDeg = lhsValue.expDeg;
        const rhsDeg = rhsValue.expDeg;
        exp.expDeg = exp.op === "mul" ? lhsDeg + rhsDeg : Math.max(lhsDeg, rhsDeg);

        exp.dim = Math.max(lhsValue.dim,rhsValue.dim);
        exp.stage = Math.max(lhsValue.stage,rhsValue.stage);

        const lhsRowOffsets = lhsValue.rowsOffsets || [0];
        const rhsRowOffsets = rhsValue.rowsOffsets || [0];
        exp.rowsOffsets = [...new Set([...lhsRowOffsets, ...rhsRowOffsets])];
    } else {
        throw new Error("Exp op not defined: "+ exp.op);
    }

    return;
}

module.exports.addInfoExpressionsSymbols = function addInfoExpressionsSymbols(symbols, expressions, exp, stark) {
    if("symbols" in exp) return;

    if (exp.op == "exp") {
        addInfoExpressionsSymbols(symbols, expressions, expressions[exp.id], stark);
        exp.symbols = expressions[exp.id].symbols ? [...expressions[exp.id].symbols] : [];

        if(expressions[exp.id].imPol) {
            const expSym = symbols.find(s => s.type === "witness" && s.expId === exp.id);
            if(!exp.symbols.find(s => s.op === "cm" && s.stage === expSym.stage && s.stageId === expSym.stageId && s.id === expSym.polId)) {
                exp.symbols.push({op: "cm", stage: expSym.stage, stageId: expSym.stageId, id: expSym.polId, rowsOffsets:[0]});
            }
        }

    } else if (["cm", "const", "custom"].includes(exp.op) && !exp.symbols) {
        if(exp.op === "cm") {
            if(exp.stageId === undefined) {
                const sym = symbols.find(s => s.type === "witness" && s.polId === exp.id);
                exp.stageId = sym.stageId;
            }
            exp.symbols = [{op: "cm", stage: exp.stage, stageId: exp.stageId, id: exp.id, rowsOffsets: exp.rowsOffsets}];
        } else if(exp.op === "const") {
            exp.symbols = [{op: exp.op, stage: exp.stage, id: exp.id, rowsOffsets: exp.rowsOffsets}];
        } else {
            exp.symbols = [{op: "custom", stage: 0, stageId: exp.stageId, id: exp.id, commitId: exp.commitId, rowsOffsets: exp.rowsOffsets}];
        }      
    } else if(["add", "sub", "mul", "neg"].includes(exp.op)) {
        const lhsValue = exp.values[0];
        const rhsValue = exp.values[1];
       
        addInfoExpressionsSymbols(symbols, expressions, lhsValue, stark);
        addInfoExpressionsSymbols(symbols, expressions, rhsValue, stark);

        let lhsSymbols = [];
        if(["cm", "challenge"].includes(lhsValue.op)) {
            if(lhsValue.stageId === undefined) {
                const sym = symbols.find(s => s.type === "witness" && s.polId === lhsValue.id);
                lhsValue.stageId = sym.stageId;
            }
            const lSym = {op: lhsValue.op, stage: lhsValue.stage, stageId: lhsValue.stageId, id: lhsValue.id};
            if(lhsValue.op === "cm") lSym.rowsOffsets = lhsValue.rowsOffsets;
            lhsSymbols.push(lSym);
        } else if(lhsValue.op === "const") {
            lhsSymbols.push({op: lhsValue.op, stage: lhsValue.stage, id: lhsValue.id, rowsOffsets: lhsValue.rowsOffsets});
        } else if(lhsValue.op === "custom") {
            lhsSymbols.push({op: lhsValue.op, stage: lhsValue.stage, id: lhsValue.id, stageId: lhsValue.stageId, commitId: lhsValue.commitId, rowsOffsets: lhsValue.rowsOffsets});
        } else if(["public", "airgroupvalue", "airvalue"].includes(lhsValue.op)) {
            lhsSymbols.push({op: lhsValue.op, stage: lhsValue.stage, id: lhsValue.id});
        } else if(lhsValue.symbols) {
            lhsSymbols.push(...lhsValue.symbols);
        }

        let rhsSymbols = [];
        if(["cm", "challenge"].includes(rhsValue.op)) {
            if(rhsValue.stageId === undefined) {
                const sym = symbols.find(s => s.type === "witness" && s.polId === rhsValue.id);
                rhsValue.stageId = sym.stageId;
            }
            const rSym = {op: rhsValue.op, stage: rhsValue.stage, stageId: rhsValue.stageId, id: rhsValue.id};
            if(rhsValue.op === "cm") rSym.rowsOffsets = rhsValue.rowsOffsets;
            rhsSymbols.push(rSym);
        } else if(rhsValue.op === "const") {
            rhsSymbols.push({op: rhsValue.op, stage: rhsValue.stage, id: rhsValue.id, rowsOffsets: rhsValue.rowsOffsets});
        } else if(rhsValue.op === "custom") {
            rhsSymbols.push({op: rhsValue.op, stage: rhsValue.stage, id: rhsValue.id, stageId: rhsValue.stageId, commitId: rhsValue.commitId, rowsOffsets: rhsValue.rowsOffsets});
        } else if(["public", "airgroupvalue", "airvalue"].includes(rhsValue.op)) {
            rhsSymbols.push({op: rhsValue.op, stage: rhsValue.stage, id: rhsValue.id});
        } else if(rhsValue.symbols) {
            rhsSymbols.push(...rhsValue.symbols);
        }

        const uniqueSymbols = [];
        for(let i = 0; i < lhsSymbols.length; ++i) {
            const symbolIdx = uniqueSymbols.findIndex(s => s.op === lhsSymbols[i].op && s.id === lhsSymbols[i].id && s.stage === lhsSymbols[i].stage);
            if(symbolIdx === -1) {
                uniqueSymbols.push(lhsSymbols[i]);
            } else if(["cm", "custom", "const"].includes(uniqueSymbols[symbolIdx].op)) {
                uniqueSymbols[symbolIdx].rowsOffsets = [...new Set(uniqueSymbols[symbolIdx].rowsOffsets.concat(...lhsSymbols[i].rowsOffsets))].sort((a, b) => a - b);
            }
        }

        for(let i = 0; i < rhsSymbols.length; ++i) {
            const symbolIdx = uniqueSymbols.findIndex(s => s.op === rhsSymbols[i].op && s.id === rhsSymbols[i].id && s.stage === rhsSymbols[i].stage);
            if(symbolIdx === -1) {
                uniqueSymbols.push(rhsSymbols[i]);
            } else if(["cm", "custom", "const"].includes(uniqueSymbols[symbolIdx].op)) {
                uniqueSymbols[symbolIdx].rowsOffsets = [...new Set(uniqueSymbols[symbolIdx].rowsOffsets.concat(...rhsSymbols[i].rowsOffsets))].sort((a, b) => a - b);

            }
        }          

        exp.symbols = uniqueSymbols.sort((a, b) => a.stage !== b.stage ? a.stage - b.stage : a.op !== b.op ? b.op.localeCompare(a.op) : ["const", "airgroupvalue", "airvalue", "public"].includes(a.op) ? a.id - b.id : a.stageId - b.stageId);
    }

    return;
}
