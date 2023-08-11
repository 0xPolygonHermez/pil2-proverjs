class ProofManagerAPI {
    constructor(proofManager) {
        this.proofManager = proofManager;
    }

    getName() {
        return proofManager.getName();
    }

    get pilout() {
        return this.proofManager.pilout.pilout;
    }

    //TODO access to pilout baseField ?

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

    // Allocate a new buffer for the given subproof and air with the given numRows.
    allocateNewBuffer(subproofId, airId, numRows, nPolsBaseField, nPolsExtension) {
        return this.proofManager.allocateNewBuffer(subproofId, airId, numRows, nPolsBaseField, nPolsExtension);
    }

    // Reallocate the buffer for the given subproof and air with the given numRows.
    reallocateBuffer(subproofId, airId, idx, numRows) {
        return this.proofManager.reallocateBuffer(subproofId, airId, idx, numRows);
    }

    // Free the buffer for the given subproof and air.
    freeBuffer(subproofId, airId) {
        return this.proofManager.freeBuffer(subproofId, airId);
    }
}

module.exports = ProofManagerAPI;
