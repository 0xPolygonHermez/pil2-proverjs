const {
    WitnessCalculatorComponent,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
} = require("../../witness_calculator.js");
const log = require("../../../logger.js");

class WitnessCalculatorLib extends WitnessCalculatorComponent {
    constructor(piloutproverAPI) {
        super("WCLib", piloutproverAPI);
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
        if(!this.initialized) {
            throw new Error(`[WCLib] ${this.name}: not initialized.`);
        }
    }

    witnessComputation(stageId) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing witness for stage ${stageId}.`);

        this.step++;
        let status = this.step >= this.nSteps ? WITNESS_ROUND_FULLY_DONE : WITNESS_ROUND_PARTIAL_DONE;

        let msg;
        if (status === WITNESS_ROUND_FULLY_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} finished.`;
        } else if (status === WITNESS_ROUND_PARTIAL_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} in progress.`
        } else if (status === WITNESS_ROUND_NOTHING_DONE) {
            msg = `<-- ${this.name}: Witness computation for stage ${stageId} not started.`
        }
        log.info(`[${this.name}]`, msg);

        return status;
    }
}

module.exports = WitnessCalculatorLib;