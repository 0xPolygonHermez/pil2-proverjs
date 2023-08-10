const log = require('../logger.js');

const WITNESS_ROUND_NOTHING_DONE = 1;
const WITNESS_ROUND_PARTIAL_DONE = 2;
const WITNESS_ROUND_FULLY_DONE = 3;

// Abstract base class for all WitnessCalculator components
class WitnessCalculatorComponent {
    constructor(name, piloutproverAPI) {
        this.name = name;
        this.piloutproverAPI = piloutproverAPI;
    }

    initialize() {
        throw new Error("Method 'initialize' must be implemented in concrete classes.");
    }
    
    witnessComputation(stageId) {
        throw new Error("Method 'resolve' must be implemented in concrete classes.");
    }
}

// WitnessCalculator class acting as the composite
class WitnessCalculatorComposite extends WitnessCalculatorComponent {
    constructor(piloutproverAPI) {
        super("WitnessCalculatorComposite", piloutproverAPI);
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

    witnessComputation(stageId) {
        log.info("[WCComposite]", `--> Starting witness computation stage ${stageId}`);

        const numWitnessCalculators = this.witnesscalculators.length;
        let witnesscalculatorStatus = Array(numWitnessCalculators).fill(WITNESS_ROUND_NOTHING_DONE);
        let nPendingToFinish = numWitnessCalculators;
        let x = nPendingToFinish;
        let lastId = -1;

        for(let i = 0; x > 0; i = (i+1) % numWitnessCalculators) {
            if(witnesscalculatorStatus[i] === WITNESS_ROUND_FULLY_DONE) continue;

            if(lastId !== -1 && lastId === i) {
                log.error("[WCComposite]", `WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
                throw new Error(`WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
            }

            const status = this.witnesscalculators[i].witnessComputation(stageId);

            if(witnesscalculatorStatus[i] !== WITNESS_ROUND_NOTHING_DONE &&
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
            else if (witnesscalculatorStatus[i] === WITNESS_ROUND_FULLY_DONE) {
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

        log.info("[WCComposite]", `<-- Witness computation stage ${stageId} finished`);
    }
}

module.exports = {
    WitnessCalculatorComponent: WitnessCalculatorComponent,
    WitnessCalculatorComposite,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE,
};