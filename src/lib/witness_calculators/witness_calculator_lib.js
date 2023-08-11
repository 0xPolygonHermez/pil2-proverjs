const {
    WitnessCalculatorComponent,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
} = require("../../witness_calculator.js");
const log = require("../../../logger.js");

class WitnessCalculatorLib extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCLib", proofmanagerAPI);
        this.initialized = false;

        this.ctx = [];

        this.currentStep = [];
        this.steps = [
            {
                whenAvailable: 'challenge1',
                callback: this.computeH1H2.bind(this)
            },
            {
                whenAvailable: 'challenge2',
                callback: this.computeZ.bind(this)
            }
        ]
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            throw new Error(`[WCLib] ${this.name}: not initialized.`);
        }
    }

    witnessComputation(stageId, subproofId) {
        this.checkInitialized();

        if(this.currentStep[subproofId] === undefined) this.currentStep[subproofId] = [];

        const subproof = this.proofmanagerAPI.getSubproofById(subproofId);
        for(let i = 0; i < subproof.airs.length; i++) {
            if(this.currentStep[subproofId][i] === undefined) this.currentStep[subproofId][i] = 0;

            // This is a mock part...
            if(this.steps[this.currentStep[subproofId][i]] === undefined) continue;

            const callback = this.steps[this.currentStep[subproofId][i]].callback;
            callback(stageId, subproofId, i)

            this.currentStep[subproofId][i]++;
        }

        return WITNESS_ROUND_FULLY_DONE;
    }

    computeH1H2(stageId, subproofId, airId) {
        const air = this.proofmanagerAPI.getAirBySubproofIdAirId(subproofId, airId);
        log.info(`[${this.name}]`, `··· Air '${air.name}' Computing H1H2 at stage ${stageId}.`);
    }

    computeZ(stageId, subproofId, airId) {
        const air = this.proofmanagerAPI.getAirBySubproofIdAirId(subproofId, airId);
        log.info(`[${this.name}]`, `··· Air '${air.name}' Computing Z at stage ${stageId}.`);
    }
}

module.exports = WitnessCalculatorLib;