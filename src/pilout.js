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

class PilOut {
    constructor(piloutFilename, protoFilename) {
        log.info("[PilOut]", "Loading pilout...");

        const piloutEncoded = fs.readFileSync(piloutFilename);
        const PilOut = protobuf.loadSync(protoFilename).lookupType("PilOut");
        this.pilout = PilOut.toObject(PilOut.decode(piloutEncoded));

        this.printInfo();

        log.info("[PilOut]", "Pilout loaded.");
    }

    printInfo() {
        log.info("[PilOut]", `Pilout name: ${this.pilout.name}`);
        log.info("[PilOut]", `  #subproofs: ${this.pilout.subproofs.length}`);

        for(const subproof of this.pilout.subproofs) this.printSubproofInfo(subproof);

        log.info("[PilOut]", `  #proofValues: ${this.pilout.numProofValues}`);
        log.info("[PilOut]", `  #publicValues: ${this.pilout.numPublicValues}`);


        if(this.pilout.publicTables) log.info("[PilOut]", `  #publicTables: ${this.pilout.publicTables.length}`);
        if(this.pilout.expressions) log.info("[PilOut]", `  #expressions: ${this.pilout.expressions.length}`);
        if(this.pilout.constraints) log.info("[PilOut]", `  #constraints: ${this.pilout.constraints.length}`);
        if(this.pilout.hints) log.info("[PilOut]", `  #hints: ${this.pilout.hints.length}`);
        if(this.pilout.symbols) log.info("[PilOut]", `  #symbols: ${this.pilout.symbols.length}`);
    }

    printSubproofInfo(subproof) {
        log.info("[PilOut]", `    > Subproof '${subproof.name}'`);

        for(const air of subproof.airs) this.printAirInfo(air);
    }

    printAirInfo(air) {
        log.info("[PilOut]", `      > Air '${air.name}'`);
        log.info("[PilOut]", `        #numRows:     ${air.numRows}`);
        log.info("[PilOut]", `        #stages:      ${air.stageWidths.length}`);
        log.info("[PilOut]", `        #expressions: ${air.expressions.length}`);
        log.info("[PilOut]", `        #constraints: ${air.constraints.length}`);
    }

    get numSubproofs() {
        return this.pilout.subproofs === undefined ? 0 : this.pilout.subproofs.length;
    }

    get numStages() {
        return this.pilout.numChallenges?.length ?? 1;
    }

    getSubproofById(subproofId) {
        if(this.pilout.subproofs === undefined) return undefined;

        return this.pilout.subproofs[subproofId];
    }

    getAirBySubproofIdAirId(subproofId, airId) {
        if(this.pilout.subproofs === undefined) return undefined;
        if(this.pilout.subproofs[subproofId].airs === undefined) return undefined;

        return this.pilout.subproofs[subproofId].airs[airId];
    }

    getNumChallenges(stageId) {
        if(this.pilout.numChallenges === undefined) return 0;

        return this.pilout.numChallenges[stageId - 1];
    }

    //TODO access to pilout numPublicValues ?

    //TODO access to pilout piloutPublicTables ?

    getExpressionById(expressionId) {
        if(this.pilout.expressions === undefined) return undefined;

        return this.pilout.expressions[expressionId];
    }

    getSymbolById(symbolId) {
        if(this.pilout.symbols === undefined) return undefined;

        return this.pilout.symbols.find(symbol => symbol.id === symbolId);
    }

    getSymbolsBySubproofId(subproofId) {
        if(this.pilout.symbols === undefined) return [];

        return this.pilout.symbols.filter(symbol => symbol.subproofId === subproofId);
    }

    getSymbolsByAirId(airId) {
        if(this.pilout.symbols === undefined) return [];

        return this.pilout.symbols.filter(symbol => symbol.airId === airId);
    }

    getSymbolsBySubproofIdAirId(subproofId, airId) {
        if(this.pilout.symbols === undefined) return [];

        return this.pilout.symbols.filter(
            (symbol) => symbol.airId === airId && symbol.subproofId === subproofId
        );
    }

    getSymbolsByStage(subproofId, airId, stageId, symbolType) {
        if (!this.pilout.symbols) return [];
    
        const symbols = this.pilout.symbols.filter(symbol =>
            symbol.subproofId === subproofId &&
            symbol.airId === airId &&
            symbol.stage === stageId &&
            (symbolType === undefined || symbol.type === symbolType)
        );
    
        return symbols.sort((a, b) => a.id - b.id);
    }
    

    getWitnessSymbolsByStage(subproofId, airId, stageId) {
        return this.getSymbolsByStage(subproofId, airId, stageId, SYMBOL_TYPES.WITNESS_COL);
    }

    getSymbolByName(name) {
        if(this.pilout.symbols === undefined) return undefined;

        return this.pilout.symbols.find(symbol => symbol.name === name);
    }

    getHintById(hintId) {
        if(this.pilout.hints === undefined) return undefined;

        return this.pilout.hints[hintId];
    }

    getHintsBySubproofId(subproofId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(hint => hint.subproofId === subproofId);
    }

    getHintsByAirId(airId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(hint => hint.airId === airId);
    }

    getHintsBySubproofIdAirId(subproofId, airId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(
            (hint) => hint.airId === airId && hint.subproofId === subproofId
        );
    }
}

module.exports = {
    PilOut,
    AGGREGATION_TYPES,
    SYMBOL_TYPES,
    HINT_FIELD_TYPES,
};
