const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../src/witness_calculator_component.js");
const WitnessCalculatorLibComponent = require("../../src/witness_calculator_lib_component.js");
const log = require("../../logger.js");

class WitnessCalculatorFibonacci extends WitnessCalculatorLibComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
    }

    initialize() {
        super.initialize();
    }

    witnessComputationStage1(subproofId, airId) {
        this.checkInitialized();

        const air = this.proofmanagerAPI.getAirBySubproofIdAirId(subproofId, airId);

        log.info(`[${this.name}]`, `--> Air '${air.name}' Computing witness for stage 1.`);

        // Strategy to fill ...
        // Try to fill the witness with the Fibonacci sequence using numRows of the air
        // If the numRows is enough to fill the witness, then return WITNESS_ROUND_FULLY_DONE
        // If the numRows is not enough to fill the witness, then a new reallocation of numRows size is needed
        // When finished, try to reduce the buffer size at the half of the witness size
        // If it's possible, try to reduce again the buffer size at the half of the witness size until it's not possible.

        //log.info(`[${this.name}]`, `Requesting new buffer allocation for air '${air.name}' with N=${air.numRows} rows.`);
        const { result, data } = this.proofmanagerAPI.allocateNewBuffer(subproofId, airId, air.numRows, 2, 0);
        if(result === false) {
            log.error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
            return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        }
        
        // NOTE As an example I use the reallocation of the buffer for the subproof 0 and air 0 
        //log.info("[ProofManager]", `Reallocating the buffer for the subproof ${subproofId} and air ${i} with ${air.numRows*2} rows.`);
        this.proofmanagerAPI.reallocateBuffer(subproofId, airId, data.idx, air.numRows/2);

        // TODO fill the buffer with the stage1 data

        log.info(`[${this.name}]`, `<-- Air '${air.name}' witness for stage 1 computed.`);

        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = WitnessCalculatorFibonacci;
