class PiloutproverAPI {
    constructor(piloutprover) {
        this.piloutprover = piloutprover;
    }

    getName() {
        return piloutprover.getName();
    }

    get pilout() {
        return this.piloutprover.pilout.pilout;
    }

    //TODO access to pilout baseField ?

    getNumChallenges(stageId) {
        if(this.pilout.numChallenges === undefined) return [];

        // TODO convert stageId to zero-based index?
        return this.pilout.numChallenges[stageId];
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

        return this.pilout.symbols.filter(symbol => symbol.subProofId === subproofId);
    }

    getSymbolsByAirId(airId) {
        if(this.pilout.symbols === undefined) return [];

        return this.pilout.symbols.filter(symbol => symbol.airId === airId);
    }

    getSymbolsBySubproofIdAirId(subproofId, airId) {
        if(this.pilout.symbols === undefined) return [];

        return this.pilout.symbols.filter(
            (symbol) => symbol.airId === airId && symbol.subProofId === subproofId
        );
    }

    getHintById(hintId) {
        if(this.pilout.hints === undefined) return undefined;

        return this.pilout.hints[hintId];
    }

    getHintsBySubproofId(subproofId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(hint => hint.subProofId === subproofId);
    }

    getHintsByAirId(airId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(hint => hint.airId === airId);
    }

    getHintsBySubproofIdAirId(subproofId, airId) {
        if(this.pilout.hints === undefined) return [];

        return this.pilout.hints.filter(
            (hint) => hint.airId === airId && hint.subProofId === subproofId
        );
    }

}

module.exports = PiloutproverAPI;
