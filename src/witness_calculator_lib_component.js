const {
    WitnessCalculatorComponent,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_FULLY_DONE,
} = require("./witness_calculator_component.js");
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

    witnessComputation(stageId, subproofId, airId) {
        this.checkInitialized();

        if (this.currentStep[subproofId] === undefined) this.currentStep[subproofId] = [];
        if (this.currentStep[subproofId][airId] === undefined) this.currentStep[subproofId][airId] = 0;

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