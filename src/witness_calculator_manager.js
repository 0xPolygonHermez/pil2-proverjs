const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_PARTIAL_DONE,
} = require("./witness_calculator_component.js");
const log = require('../logger.js');

// WitnessCalculator class acting as the composite
class WitnessCalculatorManager {
    constructor(proofmanagerAPI) {
        this.name = "WCManager";
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.witnesscalculators = [];
    }

    initialize() {
        log.info(`[${this.name}]`, "Initializing.");

        this.initialized = true;
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    registerWitnessCalculator(witnesscalculator) {
        this.checkInitialized();

        const index = this.witnesscalculators.length;
        this.witnesscalculators.push(witnesscalculator);

        return index;
    }
    
    async witnessComputation(stageId, subproofId, airId, proofCtx, subproofCtx) {
        this.checkInitialized();

        if(stageId === 0) {
            await this.witnesscalculators[0].witnessComputationStage0(subproofId, airId, proofCtx, subproofCtx);
            return;
        }

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
                ? await this.witnesscalculators[i].witnessComputationStage1(subproofId, airId,
                    proofCtx, subproofCtx)
                : await this.witnesscalculators[i].witnessComputation(stageId, subproofId, airId,
                    proofCtx, subproofCtx);

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

module.exports = WitnessCalculatorManager;
