const fs = require('fs');
const protobuf = require('protobufjs');
const log = require("../logger.js");

class PilOut {
    constructor(piloutFilename, protoFilename, options) {
        log.info("[PilOut]", "Loading pilout.");

        const piloutEncoded = fs.readFileSync(piloutFilename);
        const PilOut = protobuf.loadSync(protoFilename).lookupType("PilOut");
        this.pilout = PilOut.toObject(PilOut.decode(piloutEncoded));

        if(options && options.debug) this.printInfo();

        log.info("[PilOut]", "PilOut loaded.");
    }

    printInfo() {
        log.info("[PilOut]", `Pilout name: ${this.pilout.name}`);
        log.info("[PilOut]", `Pilout #subproofs: ${this.pilout.subproofs.length}`);
        log.info("[PilOut]", `Pilout #proofValues: ${this.pilout.numProofValues}`);
        log.info("[PilOut]", `Pilout #publicValues: ${this.pilout.numPublicValues}`);
        if(this.pilout.publicTables) log.info("[PilOut]", `Pilout #publicTables: ${this.pilout.publicTables.length}`);
        if(this.pilout.expressions) log.info("[PilOut]", `Pilout #expressions: ${this.pilout.expressions.length}`);
        if(this.pilout.constraints) log.info("[PilOut]", `Pilout #constraints: ${this.pilout.constraints.length}`);
        if(this.pilout.hints) log.info("[PilOut]", `Pilout #hints: ${this.pilout.hints.length}`);
        if(this.pilout.symbols) log.info("[PilOut]", `Pilout #symbols: ${this.pilout.symbols.length}`);
    }
}

module.exports = PilOut;
