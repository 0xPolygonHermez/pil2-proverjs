const { WitnessCalculatorComponent } = require("./witness_calculator_component.js");
const { WITNESS_ROUND_FULLY_DONE, WITNESS_ROUND_NOTHING_TO_DO } = require("../../../src/witness_calculator_manager.js");

const log = require('../logger.js');

class WitnessCalculatorLibComponent extends WitnessCalculatorComponent {
    constructor(name, proofmanagerAPI) {
        super(name, proofmanagerAPI);

        this.currentStep = [];

        this.observers = [];
    }

    subscribe(trigger, handlers) {
        this.observers.push({ trigger: trigger, handlers: handlers });
    }

    async witnessComputation(stageId, subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        if (this.currentStep[subproofId] === undefined) this.currentStep[subproofId] = [];
        if (this.currentStep[subproofId][airId] === undefined) this.currentStep[subproofId][airId] = 0;

        // step is used to simulate challenges is ready to be used...
        const step = this.currentStep[subproofId][airId];

        const toExecute = this.observers[step];
        if (toExecute === undefined) {
            return WITNESS_ROUND_NOTHING_TO_DO;
        }

        //this.canHandle(toExecute, stageId, subproofId, airId);
        toExecute.handlers.forEach(handler => handler(stageId, subproofId, airId));

        this.currentStep[subproofId][airId]++;

        return WITNESS_ROUND_FULLY_DONE;
    }
}

module.exports = WitnessCalculatorLibComponent;