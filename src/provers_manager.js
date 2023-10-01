const ProverFactory = require("./prover_factory.js");

const log = require('../logger.js');

const PROVER_OPENING_TASKS_PENDING  = 1;
const PROVER_OPENING_TASKS_COMPLETED = 2;

class ProversManager {
    constructor(proofmanagerAPI) {
        this.name = "ProversManager";
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.provers = [];
    }

    async initialize(proverConfig, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Provers Manager already initialized.`);
        }
        
        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        const newProver = await ProverFactory.createProver(proverConfig.filename, this.proofmanagerAPI);
        newProver.initialize(proverConfig.settings, options);

        this.registerProver(newProver);
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    registerProver(prover) {
        this.checkInitialized();

        const length = this.provers.push(prover);

        return length - 1;
    }

    async setup(proofCtx, subproofsCtx) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                await this.provers[0].setup(subproofCtx, airCtx);
            }
        }
    }

    async computeStage(stageId) {
        const numStages = this.proofmanagerAPI.getPilout().numStages + 1;

        if(stageId <= numStages) {
            await this.commitStage(stageId);
        } else {
            const retValue = await this.openingStage(stageId - numStages);
            if(retValue !== PROVER_OPENING_TASKS_COMPLETED) {
                this.computeProofChallenge(stageId);
            }
            return retValue;
        }

        await this.computeAirChallenges(stageId);
        
        this.computeProofChallenge(stageId);

        this.setChallenges(stageId + 1, this.proofCtx.getChallenge(stageId));

        return PROVER_OPENING_TASKS_PENDING;
    }

    async commitStage(stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.name}' Commiting stage ${stageId}.`);
                    await this.provers[0].commitStage(stageId, airInstanceCtx);
                }
            }
        }
        return PROVER_OPENING_TASKS_PENDING;
    }

    async openingStage(openingId) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.name}' Commiting stage ${openingId}.`);
                    return await this.provers[0].openingStage(openingId, airInstanceCtx);
                }
            }
        }
    }

    async computeAirChallenges(stageId) {
        log.info(`[${this.name}]`, `··· Computing challenges for stage ${stageId}`);

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    return await this.provers[0].computeAirChallenges(stageId, airInstanceCtx);
                }
            }
        }
    }

    computeProofChallenge(stageId) {
        //TODO !!!
        const challenge = this.subproofsCtx[0].airsCtx[0].instances[0].ctx.challenges[stageId];
        this.proofCtx.setChallenge(stageId, challenge);

        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.name}' Computing proof challenge for stage ${stageId}.`);
        //             this.proofCtx.setChallenge(stageId, this.prover.computeProofChallenge(stageId, airInstanceCtx));
        //         }
        //     }
        // }
    }

    setChallenges(stageId, challenge) {
        log.info(`[${this.name}]`, `··· Setting challenges for stage ${stageId}`);

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    this.provers[0].setChallenges(stageId, airInstanceCtx, challenge);
                }
            }
        }
    }

}

module.exports = {
    ProversManager,
    PROVER_OPENING_TASKS_PENDING,
    PROVER_OPENING_TASKS_COMPLETED
};
