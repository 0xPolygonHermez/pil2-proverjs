const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../src/witness_calculator_component.js");
const WitnessCalculatorLibComponent = require("../../src/witness_calculator_lib_component.js");
const log = require("../../logger.js");

class ExecutorFibonacci extends WitnessCalculatorLibComponent {
    constructor(proofmanagerAPI) {
        super("WCFibonacci", proofmanagerAPI);
    }

    initialize() {
        super.initialize();
    }

    async witnessComputationStage1(subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofId, airId);

        // Strategy to fill ...
        // Try to fill the witness with the Fibonacci sequence using numRows of the air
        // If the numRows is enough to fill the witness, then return WITNESS_ROUND_FULLY_DONE
        // If the numRows is not enough to fill the witness, then a new reallocation of numRows size is needed
        // When finished, try to reduce the buffer size at the half of the witness size
        // If it's possible, try to reduce again the buffer size at the half of the witness size until it's not possible.

        const { result, airInstance } = this.proofmanagerAPI.addAirInstance(subproofCtx, airId, air.numRows);

        if(result === false) {
            log.error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New buffer allocation for air '${air.name}' with N=${air.numRows} rows failed.`);
            return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        }        

        // NOTE As an example I use the reallocation of the buffer for the subproof 0 and air 0 
        //log.info("[ProofManager]", `Reallocating the buffer for the subproof ${subproofId} and air ${i} with ${air.numRows*2} rows.`);
        this.proofmanagerAPI.resizeAirInstance(subproofCtx, airId, airInstance.instanceId, air.numRows/2);

        // Fill the witnesses data buffers
        const witnessCols = pilout.getWitnessSymbolsByStage(subproofId, airId, 1);
        const Fibonacci_l1 = pilout.getSymbolByName("Fibonacci.l1");
        const Fibonacci_l2 = pilout.getSymbolByName("Fibonacci.l2");
        
        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = ExecutorFibonacci;
