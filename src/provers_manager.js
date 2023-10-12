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

    getProverId(subproofId, airId, numRows) {
        return `${subproofId}-${airId}-${numRows}`;
    }

    async initialize(proverConfig, pilout, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Provers Manager already initialized.`);
        }
        
        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        for( let i = 0; i < pilout.pilout.subproofs.length; i++) {
            for( let j = 0; j < pilout.pilout.subproofs[i].airs.length; j++) {
                const prover = await ProverFactory.createProver(proverConfig.filename, this.proofmanagerAPI);

                const airName = pilout.pilout.subproofs[i].airs[j].name;
                const N = pilout.pilout.subproofs[i].airs[j].numRows;
                let settings =
                    proverConfig.settings[airName]?.[N] ||
                    proverConfig.settings[airName]?.default ||
                    proverConfig.settings.default;
                
                if (!settings) {
                    log.error(`[${this.name}]`, `No settings for air '${airName}'${N ? ` with N=${N}` : ''}`);
                    throw new Error(`[${this.name}] No settings for air '${airName}'${N ? ` with N=${N}` : ''}`);
                }

                prover.initialize(settings, options);

                const id = this.getProverId(i, j, pilout.pilout.subproofs[i].airs[j].numRows);

                this.provers[id] = prover;
            }
        }
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

    async setup() {
        this.checkInitialized();

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);

                await this.provers[id].setup(airCtx);
            }
        }
    }

    async newProof() {
        this.checkInitialized();

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);

                await this.provers[id].newProof(airCtx);
            }
        }
    }

    async computeStage(stageId) {
        const numStages = this.proofmanagerAPI.getPilout().numStages + 1;

        if(stageId === 1) await this.newProof();
        
        if(stageId <= numStages) {
            await this.commitStage(stageId);
        } else {
            const retValue = await this.openingStage(stageId - numStages);
            if(retValue !== PROVER_OPENING_TASKS_COMPLETED) {
                this.computeProofChallenge(stageId);
            }
            return retValue;
        }
        
        this.computeProofChallenge(stageId);

        this.setChallenges(stageId + 1, this.proofCtx.getChallenge(stageId));

        return PROVER_OPENING_TASKS_PENDING;
    }

    async commitStage(stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.name}' Commiting stage ${stageId}.`);
                    const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);

                    await this.provers[id].commitStage(stageId, airInstanceCtx);
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
                    const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);

                    return await this.provers[id].openingStage(openingId, airInstanceCtx);
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
                    const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);
                    
                    this.provers[id].setChallenges(stageId, airInstanceCtx, challenge);
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
