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
        this.airout = AirOut.toObject(AirOut.decode(airoutEncoded));

        this.printInfo();

        log.info("[AirOutPrsr]", "AirOut loaded.");
    }

    printInfo() {
        log.info("[AirOutPrsr]", `AirOut name: ${this.airout.name}`);
        log.info("[AirOutPrsr]", `  #subproofs: ${this.airout.subproofs.length}`);

        for(const subproof of this.airout.subproofs) this.printSubproofInfo(subproof);

        log.info("[AirOutPrsr]", `  #proofValues: ${this.airout.numProofValues}`);
        log.info("[AirOutPrsr]", `  #publicValues: ${this.airout.numPublicValues}`);


        if(this.airout.publicTables) log.info("[AirOutPrsr]", `  #publicTables: ${this.airout.publicTables.length}`);
        if(this.airout.expressions) log.info("[AirOutPrsr]", `  #expressions: ${this.airout.expressions.length}`);
        if(this.airout.constraints) log.info("[AirOutPrsr]", `  #constraints: ${this.airout.constraints.length}`);
        if(this.airout.hints) log.info("[AirOutPrsr]", `  #hints: ${this.airout.hints.length}`);
        if(this.airout.symbols) log.info("[AirOutPrsr]", `  #symbols: ${this.airout.symbols.length}`);
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
        return this.airout.subproofs === undefined ? 0 : this.airout.subproofs.length;
    }

    get numStages() {
        return this.airout.numChallenges?.length ?? 1;
    }

    getSubproofById(subproofId) {
        if(this.airout.subproofs === undefined) return undefined;

        return this.airout.subproofs[subproofId];
    }

    getAirBySubproofIdAirId(subproofId, airId) {
        if(this.airout.subproofs === undefined) return undefined;
        if(this.airout.subproofs[subproofId].airs === undefined) return undefined;

        const air = this.airout.subproofs[subproofId].airs[airId];
        air.subproofId = subproofId;
        air.airId = airId;
        return air;
    }

    getNumChallenges(stageId) {
        if(this.airout.numChallenges === undefined) return 0;

        return this.airout.numChallenges[stageId - 1];
    }

    //TODO access to AirOut numPublicValues ?

    //TODO access to AirOut AirOutPublicTables ?

    getExpressionById(expressionId) {
        if(this.airout.expressions === undefined) return undefined;

        return this.airout.expressions[expressionId];
    }

    getSymbolById(symbolId) {
        if(this.airout.symbols === undefined) return undefined;

        return this.airout.symbols.find(symbol => symbol.id === symbolId);
    }

    getSymbolByName(name) {
        if(this.airout.symbols === undefined) return undefined;

        return this.airout.symbols.find(symbol => symbol.name === name);
    }

    getSymbolsBySubproofId(subproofId) {
        if(this.airout.symbols === undefined) return [];

        return this.airout.symbols.filter(symbol => symbol.subproofId === subproofId);
    }

    getSymbolsByAirId(airId) {
        if(this.airout.symbols === undefined) return [];

        return this.airout.symbols.filter(symbol => symbol.airId === airId);
    }

    getSymbolsBySubproofIdAirId(subproofId, airId) {
        if(this.airout.symbols === undefined) return [];

        return this.airout.symbols.filter((symbol) => symbol.subproofId === subproofId && symbol.airId === airId);
    }

    getSymbolsByStage(subproofId, airId, stageId, symbolType) {
        if (!this.airout.symbols) return [];
    
        const symbols = this.airout.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            symbol.stage === stageId &&
            (symbolType === undefined || symbol.type === symbolType)
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }

    getColsBySubproofIdAirId(subproofId, airId) {
        if (!this.airout.symbols) return [];
    
        const symbols = this.airout.symbols.filter(symbol =>
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
        if(this.airout.symbols === undefined) return undefined;

        return this.airout.symbols.find(symbol => symbol.name === name);
    }

    getHintById(hintId) {
        if(this.airout.hints === undefined) return undefined;

        return this.airout.hints[hintId];
    }

    getHintsBySubproofId(subproofId) {
        if(this.airout.hints === undefined) return [];

        return this.airout.hints.filter(hint => hint.subproofId === subproofId);
    }

    getHintsByAirId(airId) {
        if(this.airout.hints === undefined) return [];

        return this.airout.hints.filter(hint => hint.airId === airId);
    }

    getHintsBySubproofIdAirId(subproofId, airId) {
        if(this.airout.hints === undefined) return [];

        return this.airout.hints.filter(
            (hint) => hint.airId === airId && hint.subproofId === subproofId
        );
    }
}

module.exports = {
    AirOut,
    AGGREGATION_TYPES,
    SYMBOL_TYPES,
    HINT_FIELD_TYPES,
};
