const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WitnessCalculatorComponent
} = require("../../../src/witness_calculator_component.js");
const log = require("../../../logger.js");

class ExecutorSimple1 extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCSimple1", proofmanagerAPI);
    }

    async witnessComputationStage0(subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(subproofCtx, airId);

        if(result === false) {
            log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
            return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        }
        //const pilout = this.proofmanagerAPI.getPilout();
        // let air = pilout.getAirBySubproofIdAirId(subproofId, airId);

        // const constPols = getFixedPolsPil2(pilout.pilout.symbols, air, proofCtx.F);
        // const cmPols = newCommitPolsArrayPil2(pilout.pilout.symbols, air.symbols, air.numRows, proofCtx.F);

        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofId, airId);
        for (let i = 0; i < air.numRows; i++) {
            airInstanceCtx.cmPols.Simple1.a[i] = BigInt(i);
        }

        return WITNESS_ROUND_FULLY_DONE;
    }

    async witnessComputationStage1(subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        const pilout = this.proofmanagerAPI.getPilout();
        const air = pilout.getAirBySubproofIdAirId(subproofId, airId);

        const subproofMap = {
            'Simple1': this.computeSimple1Air,
        };

        if(subproofMap[air.name] === undefined) {
            log.error(`[${this.name}]`, `Air '${air.name}' not found.`);
            throw new Error(`[${this.name}]`, `Air '${air.name}' not found.`);
        }

        // Strategy to create air instances
        // In some cases, the witness size is not enough to fill the witness buffer
        // In this case, a new air instance will be created with the defaukt numRows size provided by the air
        // We will adjust the last air instance numRows size dividing it by 2 until witness data doesn't fit in the witness buffer
        // To create a new Air instance: this.proofmanagerAPI.addAirInstance(subproofCtx, airId, numRows) 
        // To resize an existing Air instance: this.proofmanagerAPI.addAirInstance(subproofCtx, airId, instanceId, newNumRows) 
        // To remove an existing Air instance: this.proofmanagerAPI.removeAirInstance(subproofCtx, airId, instanceId) 

        // const { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(subproofCtx, airId, air.numRows);
        // if(result === false) {
        //     log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        //     throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
        //     return WITNESS_ROUND_NOTHING_DONE; //Unreachable, but needed to avoid eslint error
        // }        

        // subproofMap[air.name].call(this, proofCtx, subproofCtx, airInstanceCtx, pilout, air);
        
        return WITNESS_ROUND_FULLY_DONE;
    }


    computeSimple1Air(proofCtx, subproofCtx, airInstanceCtx, pilout, air) {
        // Fill the witnesses data buffers
        const witnessCols = pilout.getWitnessSymbolsByStage(subproofCtx.subproofId, airInstanceCtx.airId, 1);
    }
}

module.exports = ExecutorSimple1;
