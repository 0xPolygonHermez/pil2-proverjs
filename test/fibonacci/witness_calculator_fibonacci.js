const {
    WitnessCalculatorComponent,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../src/witness_calculator.js");
const log = require("../../logger.js");

class WitnessCalculatorFibonacci extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
        this.initialized = false;
        this.nSteps = 1;
        this.step = 0;
        this.lastStageId = -1;
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    checkInitialized() {
        if (!this.initialized) {
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    witnessComputationStage1(subproofId) {
        const subproof = this.proofmanagerAPI.getSubproofById(subproofId);
        for(let i = 0; i < subproof.airs.length; i++) {
            const air = subproof.airs[i];

            log.info(`[${this.name}]`, `--> Air '${air.name}' Computing witness for stage 1.`);

            // Strategy to fill ...
            // Try to fill the witness with the Fibonacci sequence using numRows of the air
            // If the numRows is enough to fill the witness, then return WITNESS_ROUND_FULLY_DONE
            // If the numRows is not enough to fill the witness, then a new reallocation of numRows size is needed
            // When finished, try to reduce the buffer size at the half of the witness size
            // If it's possible, try to reduce again the buffer size at the half of the witness size until it's not possible.

            //log.info(`[${this.name}]`, `Requesting new buffer allocation for air '${air.name}' with N=${air.numRows} rows.`);
            const { result, data } = this.proofmanagerAPI.allocateNewBuffer(subproofId, i, air.numRows, 2, 0);
            if(result === false) {
                log.error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
                throw new Error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
                return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
            }
            
            // NOTE As an example I use the reallocation of the buffer for the subproof 0 and air 0 
            //log.info("[ProofManager]", `Reallocating the buffer for the subproof ${subproofId} and air ${i} with ${air.numRows*2} rows.`);
            this.proofmanagerAPI.reallocateBuffer(subproofId, i, data.idx, air.numRows/2);

            // TODO fill the buffer with the stage1 data

            log.info(`[${this.name}]`, `<-- Air '${air.name}' witness for stage 1 computed.`);
        }


        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = WitnessCalculatorFibonacci;
