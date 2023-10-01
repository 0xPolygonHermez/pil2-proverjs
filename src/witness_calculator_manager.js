const {
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_FULLY_DONE,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_PARTIAL_DONE,
} = require("./witness_calculator_component.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");

const log = require('../logger.js');

// WitnessCalculator class acting as the composite
class WitnessCalculatorManager {
    constructor(proofmanagerAPI) {
        this.name = "WCManager";
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.witnesscalculators = [];
    }

    async initialize(witnessCalculatorsConfig, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Witness Calculator Manager already initialized.`);
        }

        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        for(const witnessCalculator of witnessCalculatorsConfig) {
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(witnessCalculator.witnessCalculatorLib, this.proofmanagerAPI);
            newWitnessCalculator.initialize(witnessCalculator.settings, options);

            this.registerWitnessCalculator(newWitnessCalculator);
        }
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    registerWitnessCalculator(witnesscalculator) {
        this.checkInitialized();

        const length = this.witnesscalculators.push(witnesscalculator);

        return length - 1;
    }

    async setup() {
        this.checkInitialized();

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                const { result, airInstanceCtx } = this.proofmanagerAPI.addAirInstance(airCtx.subproofCtx, airCtx.airId);

                if (result === false) {
                    log.error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                    throw new Error(`[${this.name}]`, `New air instance for air '${air.name}' with N=${air.numRows} rows failed.`);
                }
            }
        }
    }

    async computeWitness(stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            log.info(`[${this.name}]`, `--> Subproof '${subproofCtx.name}' witness computation stage ${stageId}`);
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.name}' Computing witness for stage ${stageId}.`);
                    await this.witnessComputation(stageId, airInstanceCtx);
                }
            }
            log.info(`[${this.name}]`, `<-- Subproof '${subproofCtx.name}' witness computation stage ${stageId}`);
        }
    }

    async witnessComputation(stageId, airInstanceCtx) {
        this.checkInitialized();

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

            const status = await this.witnesscalculators[i].witnessComputation(stageId, airInstanceCtx);

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
