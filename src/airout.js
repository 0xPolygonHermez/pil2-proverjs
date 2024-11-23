const fs = require('fs');
const protobuf = require('protobufjs');
const log = require("../logger.js");

const SYMBOL_TYPES = {
    IM_COL: 0,
    FIXED_COL: 1,
    PERIODIC_COL: 2,
    WITNESS_COL: 3,
    PROOF_VALUE: 4,
    AIRGROUP_VALUE: 5,
    PUBLIC_VALUE: 6,
    PUBLIC_TABLE: 7,
    CHALLENGE: 8,
};

const airoutProto = require.resolve('./pilout.proto');

class AirOut {
    constructor(airoutFilename = "", pilout) {
        console.log(airoutFilename);
        if(airoutFilename != "") {
            log.info("[AirOut    ]", "··· Loading airout...");

            const airoutEncoded = fs.readFileSync(airoutFilename);
            const AirOut = protobuf.loadSync(airoutProto).lookupType("PilOut");
            Object.assign(this, AirOut.toObject(AirOut.decode(airoutEncoded)));
        } else {
            Object.assign(this, pilout);
        }
        
        this.preprocessAirout();
    }

    preprocessAirout() {
        for(let i=0; i<this.airGroups.length; i++) {
            const airgroup = this.airGroups[i];
            airgroup.airgroupId = i;

            const airgroupvalues = this.getAirgroupValuesByAirgroupId(i);

            for(let j=0; j<airgroup.airs.length; j++) {
                const air = airgroup.airs[j];
                air.airgroupId = i;
                air.airId = j;

                air.symbols = this.getSymbolsByAirgroupIdAirId(airgroup.airgroupId, air.airId);

                for(const airgroupValue of airgroupvalues) {
                    air.symbols.push( { ...airgroupValue, airId: j });
                }
                air.hints = this.getHintsByAirgroupIdAirId(airgroup.airgroupId, air.airId);
                air.numChallenges = this.numChallenges;
                air.airGroupValues = airgroup.airGroupValues;
                
                if(!air.constraints) {
                    log.error(`[Airout    ]`, `Air ${air.airId} of airgroup ${air.airgroupId} does not have any constraint!`);
                    throw new Error(`Air ${air.airId} of airgroup ${air.airgroupId} does not have any constraint!`);
                }
            }
        }
    }

    getAirgroupValuesByAirgroupId(airgroupId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.airGroupId === airgroupId && symbol.type === SYMBOL_TYPES.AIRGROUP_VALUE && symbol.airId === undefined);
    }

    getProofValues() {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(symbol => symbol.type === SYMBOL_TYPES.PROOF_VALUE);
    }

    getSymbolsByAirgroupIdAirId(airgroupId, airId) {
        if(this.symbols === undefined) return [];

        return this.symbols.filter(
            (symbol) => (symbol.airGroupId === undefined) || (symbol.airGroupId === airgroupId && symbol.airId === airId));
    }

    getHintsByAirgroupIdAirId(airgroupId, airId) {
        if(this.hints === undefined) return [];

        return this.hints.filter(
            (hint) => (hint.airGroupId === undefined) || ( hint.airGroupId === airgroupId && hint.airId === airId));
    }
}

module.exports = {
    AirOut,
};
