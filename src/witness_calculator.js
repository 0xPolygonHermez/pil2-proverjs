const log = require('../logger.js');

const WITNESS_ROUND_NOTHING_TO_DO = 1;
const WITNESS_ROUND_NOTHING_DONE = 2;
const WITNESS_ROUND_PARTIAL_DONE = 3;
const WITNESS_ROUND_FULLY_DONE = 4;

// Abstract base class for all WitnessCalculator components
class WitnessCalculatorComponent {
    constructor(name, proofmanagerAPI) {
        this.name = name;
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }
    
    checkInitialized() {
        if(!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    witnessComputationStage1(subproofId, airId) {
        return WITNESS_ROUND_NOTHING_TO_DO;
    }

    witnessComputation(stageId, subproofId, airId) {
        return WITNESS_ROUND_NOTHING_TO_DO;
    }

    witnessComputationStageQ(subproofId, airId) {
        return WITNESS_ROUND_NOTHING_TO_DO;
    }
}

class WitnessCalculatorLibComponent extends WitnessCalculatorComponent {
    constructor(name, proofmanagerAPI) {
        super(name, proofmanagerAPI);

        this.currentStep = [];
        
        this.observers = [];
    }
    
    subscribe(trigger, handlers) {
        this.observers.push({trigger: trigger, handlers: handlers});
    }

    witnessComputation(stageId, subproofId, airId) {
        this.checkInitialized();

        if(this.currentStep[subproofId] === undefined) this.currentStep[subproofId] = [];
        if(this.currentStep[subproofId][airId] === undefined) this.currentStep[subproofId][airId] = 0;

        const step = this.currentStep[subproofId][airId];

        const toExecute = this.observers[step];
        if(toExecute === undefined) {
            log.info(`[${this.name}]`, `--> Nothing to do at stage ${stageId}.`);
            return WITNESS_ROUND_NOTHING_TO_DO;
        }

        //this.canHandle(toExecute, stageId, subproofId, airId);
        toExecute.handlers.forEach(handler => handler(stageId, subproofId, airId));

        this.currentStep[subproofId][airId]++

        return WITNESS_ROUND_FULLY_DONE;
    }
}

// WitnessCalculator class acting as the composite
class WitnessCalculatorComposite extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WitnessCalculatorComposite", proofmanagerAPI);
        this.witnesscalculators = [];
    }

    registerWitnessCalculator(witnesscalculator) {
        const index = this.witnesscalculators.length;
        this.witnesscalculators.push(witnesscalculator);

        return index;
    }

    unregisterWitnessCalculator(index) {
        if (index !== -1) {
            this.witnesscalculators.splice(index, 1);
        }
    }

    getWitnessCalculators() {
        return this.witnesscalculators;
    }

    witnessComputation(stageId, subproofId, airId) {
        const numWitnessCalculators = this.witnesscalculators.length;
        let witnesscalculatorStatus = Array(numWitnessCalculators).fill(WITNESS_ROUND_NOTHING_DONE);
        let nPendingToFinish = numWitnessCalculators;
        let x = nPendingToFinish;
        let lastId = -1;

        for(let i = 0; x > 0; i = (i+1) % numWitnessCalculators) {
            if(witnesscalculatorStatus[i] === WITNESS_ROUND_FULLY_DONE || 
               witnesscalculatorStatus[i] === WITNESS_ROUND_NOTHING_TO_DO) continue;

            if(lastId !== -1 && lastId === i) {
                log.error("[WCComposite]", `WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
                throw new Error(`WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
            }

            const status = stageId === 1
                ? this.witnesscalculators[i].witnessComputationStage1(subproofId, airId)
                : this.witnesscalculators[i].witnessComputation(stageId, subproofId, airId);

            if(witnesscalculatorStatus[i] !== WITNESS_ROUND_NOTHING_TO_DO &&
               witnesscalculatorStatus[i] !== WITNESS_ROUND_NOTHING_DONE &&
               witnesscalculatorStatus[i] !== WITNESS_ROUND_PARTIAL_DONE &&
               witnesscalculatorStatus[i] !== WITNESS_ROUND_FULLY_DONE) {
                log.error("[WCComposite]", `Unknown witnesscalculator status return value: ${witnesscalculatorStatus[i]}`);
                throw new Error(`Unknown witnesscalculator status return value: ${witnesscalculatorStatus[i]}`);
            }

            witnesscalculatorStatus[i] = status;

            if(status === WITNESS_ROUND_FULLY_DONE || status === WITNESS_ROUND_PARTIAL_DONE) {
                lastId = i;
            }

            if (witnesscalculatorStatus[i] === WITNESS_ROUND_NOTHING_DONE) x--;
            else if (witnesscalculatorStatus[i] === WITNESS_ROUND_FULLY_DONE ||
                witnesscalculatorStatus[i] === WITNESS_ROUND_NOTHING_TO_DO) {
                nPendingToFinish--;
                x = nPendingToFinish;
            }
        }

        if(nPendingToFinish !== 0) {
            witnesscalculatorStatus.forEach((status, index) => {
                if(status !== WITNESS_ROUND_FULLY_DONE)
                    log.error("[WCComposite]", `WitnessCalculator ${this.witnesscalculators[index].name} did not finish witness computation for stage ${stageId}`);
            });
            log.error("[WCComposite]", `Unable to compute all witnesses for stage ${stageId}`);
            throw new Error(`Unable to compute all witnesses for stage ${stageId}`);
        }
    }
}

module.exports = {
    WitnessCalculatorComponent,
    WitnessCalculatorLibComponent,
    WitnessCalculatorComposite,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
};