const fs = require('fs');
const protobuf = require('protobufjs');
const log = require("../logger.js");

const AGGREGATION_TYPES = {
    SUM: 0,
    PROD: 1,
};

const SYMBOL_TYPES = {
    IM_COL: 0,
    FIXED_COL: 1,
    PERIODIC_COL: 2,
    WITNESS_COL: 3,
    PROOF_VALUE: 4,
    SUBPROOF_VALUE: 5,
    PUBLIC_VALUE: 6,
    PUBLIC_TABLE: 7,
    CHALLENGE: 8,
};

const HINT_FIELD_TYPES = {
    STRING: 0,
    OPERAND: 1,
    ARRAY: 2,
};

class AirOut {
    constructor(airoutFilename, protoFilename) {
        log.info("[AirOutPrsr]", "Loading airout...");

        const airoutEncoded = fs.readFileSync(airoutFilename);
        const AirOut = protobuf.loadSync(protoFilename).lookupType("PilOut");

        Object.assign(this, AirOut.toObject(AirOut.decode(airoutEncoded)));

        this.printInfo();

        log.info("[AirOutPrsr]", "AirOut loaded.");
    }

    printInfo() {
        log.info("[AirOutPrsr]", `AirOut name: ${this.name}`);
        log.info("[AirOutPrsr]", `  #subproofs: ${this.subproofs.length}`);

        for(const subproof of this.subproofs) this.printSubproofInfo(subproof);

        log.info("[AirOutPrsr]", `  #proofValues: ${this.numProofValues}`);
        log.info("[AirOutPrsr]", `  #publicValues: ${this.numPublicValues}`);


        if(this.publicTables) log.info("[AirOutPrsr]", `  #publicTables: ${this.publicTables.length}`);
        if(this.expressions) log.info("[AirOutPrsr]", `  #expressions: ${this.expressions.length}`);
        if(this.constraints) log.info("[AirOutPrsr]", `  #constraints: ${this.constraints.length}`);
        if(this.hints) log.info("[AirOutPrsr]", `  #hints: ${this.hints.length}`);
        if(this.symbols) log.info("[AirOutPrsr]", `  #symbols: ${this.symbols.length}`);
    }

    printSubproofInfo(subproof) {
        log.info("[AirOutPrsr]", `  -> Subproof '${subproof.name}'`);

        for(const air of subproof.airs) this.printAirInfo(air);
    }

    printAirInfo(air) {
        log.info("[AirOutPrsr]", `    -> Air '${air.name}'`);
        log.info("[AirOutPrsr]", `        #numRows:     ${air.numRows}`);
        log.info("[AirOutPrsr]", `        #stages:      ${air.stageWidths.length}`);
        log.info("[AirOutPrsr]", `        #expressions: ${air.expressions.length}`);
        log.info("[AirOutPrsr]", `        #constraints: ${air.constraints.length}`);
    }

    get numSubproofs() {
        return this.subproofs === undefined ? 0 : this.subproofs.length;
    }

    get numStages() {
        return this.numChallenges?.length ?? 1;
    }

    getSubproofById(subproofId) {
        if(this.subproofs === undefined) return undefined;

        return this.subproofs[subproofId];
    }

    getAirBySubproofIdAirId(subproofId, airId) {
        if(this.subproofs === undefined) return undefined;
        if(this.subproofs[subproofId].airs === undefined) return undefined;

        const air = this.subproofs[subproofId].airs[airId];
        air.subproofId = subproofId;
        air.airId = airId;
        return air;
    }

    getNumChallenges(stageId) {
        if(this.numChallenges === undefined) return 0;

        return this.numChallenges[stageId - 1];
    }

    //TODO access to AirOut numPublicValues ?

    //TODO access to AirOut AirOutPublicTables ?

    getExpressionById(expressionId) {
        if(this.expressions === undefined) return undefined;

        return this.expressions[expressionId];
    }

    getSymbolById(symbolId) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.id === symbolId);
    }

    getSymbolByName(name) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.name === name);
    }

    getSymbolsBySubproofId(subproofId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.subproofId === subproofId);
    }

    getSymbolsByAirId(airId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.airId === airId);
    }

    getSymbolsBySubproofIdAirId(subproofId, airId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(
            (symbol) => (symbol.subproofId === undefined) || (symbol.subproofId === subproofId && symbol.airId === airId));
    }

    getSymbolsByStage(subproofId, airId, stageId, symbolType) {
        if (this.symbols === undefined) return [];
    
        const symbols = this.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            symbol.stage === stageId &&
            (symbolType === undefined || symbol.type === symbolType)
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }

    getColsBySubproofIdAirId(subproofId, airId) {
        if (this.symbols === undefined) return [];
    
        const symbols = this.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            ([1, 2, 3].includes(symbol.type))
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }

    getWitnessSymbolsByStage(subproofId, airId, stageId) {
        return this.getSymbolsByStage(subproofId, airId, stageId, SYMBOL_TYPES.WITNESS_COL);
    }

    getSymbolByName(name) {
        if(this.symbols === undefined) return undefined;

        return this.symbols.find(symbol => symbol.name === name);
    }

    getHintById(hintId) {
        if(this.hints === undefined) return undefined;

        return this.hints[hintId];
    }

    getHintsBySubproofId(subproofId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(hint => hint.subproofId === subproofId);
    }

    getHintsByAirId(airId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(hint => hint.airId === airId);
    }

    getHintsBySubproofIdAirId(subproofId, airId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(
            (hint) => (hint.subproofId === undefined) || ( hint.subproofId === subproofId && hint.airId === airId));
    }
}

module.exports = {
    AirOut,
    AGGREGATION_TYPES,
    SYMBOL_TYPES,
    HINT_FIELD_TYPES,
};
