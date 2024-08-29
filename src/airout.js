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

const airoutProto = require.resolve('pil2-compiler/src/pilout.proto');

class AirOut {
    constructor(airoutFilename) {
        log.info("[AirOut    ]", "··· Loading airout...");

        const airoutEncoded = fs.readFileSync(airoutFilename);
        const AirOut = protobuf.loadSync(airoutProto).lookupType("PilOut");

        Object.assign(this, AirOut.toObject(AirOut.decode(airoutEncoded)));

        this.preprocessAirout();

        this.printInfo();
    }

    preprocessAirout() {
        for(let i=0; i<this.subproofs.length; i++) {
            const subproof = this.subproofs[i];
            subproof.subproofId = i;

            const subproofValues = this.getSubproofValuesBySubproofId(i);

            for(let j=0; j<subproof.airs.length; j++) {
                const air = subproof.airs[j];
                air.subproofId = i;
                air.airId = j;

                air.symbols = this.getSymbolsBySubproofIdAirId(subproof.subproofId, air.airId);

                for(const subAirValue of subproofValues) {
                    air.symbols.push( { ...subAirValue, airId: j });
                }
                air.hints = this.getHintsBySubproofIdAirId(subproof.subproofId, air.airId);
                air.numChallenges = this.numChallenges;
                air.aggregationTypes = subproof.subproofvalues;
                
                if(!air.constraints) {
                    log.error(`[Airout    ]`, `Air ${air.airId} of subproof ${air.subproofId} does not have any constraint!`);
                    throw new Error(`Air ${air.airId} of subproof ${air.subproofId} does not have any constraint!`);
                }
            }
        }
    }

    printInfo() {
        log.info("[AirOut    ]", `··· AirOut Info`);
        log.info("[AirOut    ]", `    Name: ${this.name}`);
        log.info("[AirOut    ]", `    #Subproofs: ${this.subproofs.length}`);

        log.info("[AirOut    ]", `    #ProofValues: ${this.numProofValues}`);
        log.info("[AirOut    ]", `    #PublicValues: ${this.numPublicValues}`);

        if(this.publicTables) log.info("[AirOut    ]", `    #PublicTables: ${this.publicTables.length}`);
        if(this.expressions) log.info("[AirOut    ]", `    #Expressions: ${this.expressions.length}`);
        if(this.constraints) log.info("[AirOut    ]", `    #Constraints: ${this.constraints.length}`);
        if(this.hints) log.info("[AirOut    ]", `    #Hints: ${this.hints.length}`);
        if(this.symbols) log.info("[AirOut    ]", `    #Symbols: ${this.symbols.length}`);

        for(const subproof of this.subproofs) this.printSubproofInfo(subproof);
    }

    printSubproofInfo(subproof) {
        log.info("[AirOut    ]", `    > Subproof '${subproof.name}':`);

        for(const air of subproof.airs) this.printAirInfo(air);
    }

    printAirInfo(air) {
        log.info("[AirOut    ]", `       + Air '${air.name}'`);
        log.info("[AirOut    ]", `         NumRows:     ${air.numRows}`);
        log.info("[AirOut    ]", `         Stages:      ${air.stageWidths.length}`);
        log.info("[AirOut    ]", `         Expressions: ${air.expressions.length}`);
        log.info("[AirOut    ]", `         Constraints: ${air.constraints.length}`);
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

    getSubproofValuesBySubproofId(subproofId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.subproofId === subproofId && symbol.type === SYMBOL_TYPES.SUBPROOF_VALUE && symbol.airId === undefined);
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
