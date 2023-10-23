const ProverFactory = require("./prover_factory.js");

const log = require('../logger.js');

const PROVER_OPENINGS_PENDING  = 1;
const PROVER_OPENINGS_COMPLETED = 2;

class ProversManager {
    constructor(proofSharedMemory) {
        this.name = "ProversManager";
        this.proofSharedMemory = proofSharedMemory;

        this.initialized = false;
        this.provers = [];
    }

    getProverId(subproofId, airId, numRows) {
        return `${subproofId}-${airId}-${numRows}`;
    }

    async initialize(proverConfig, airout, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Provers Manager already initialized.`);
        }
        
        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        for( let i = 0; i < airout.airout.subproofs.length; i++) {
            for( let j = 0; j < airout.airout.subproofs[i].airs.length; j++) {
                const prover = await ProverFactory.createProver(proverConfig.filename, this.proofSharedMemory);

                const airName = airout.airout.subproofs[i].airs[j].name;
                const N = airout.airout.subproofs[i].airs[j].numRows;
                let settings =
                    proverConfig.settings[airName] ||
                    // proverConfig.settings[airName]?.default ||
                    proverConfig.settings.default;
                
                if (!settings) {
                    log.error(`[${this.name}]`, `No settings for air '${airName}'${N ? ` with N=${N}` : ''}`);
                    throw new Error(`[${this.name}] No settings for air '${airName}'${N ? ` with N=${N}` : ''}`);
                }

                prover.initialize(settings, options);

                const id = this.getProverId(i, j, airout.airout.subproofs[i].airs[j].numRows);

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
                const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);

                await this.provers[proverId].setup(airCtx);
            }
        }
    }

    async newProof(publics) {
        this.checkInitialized();

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);

                await this.provers[id].newProof(airCtx, publics);
            }
        }
    }

    async computeStage(stageId, publics) {
        const numStages = this.proofSharedMemory.getAirout().numStages + 1;

        if(stageId === 1) await this.newProof(publics);
        
        if(stageId <= numStages) {
            await this.commitStage(stageId);
        } else {
            const retValue = await this.openingStage(stageId - numStages);
            if(retValue !== PROVER_OPENINGS_COMPLETED) {
                this.computeProofChallenge(stageId);
            }
            return retValue;
        }
        
        this.computeProofChallenge(stageId);

        this.setChallenges(stageId + 1, this.proofSharedMemory.getChallenge(stageId));

        return PROVER_OPENINGS_PENDING;
    }

    async commitStage(stageId) {
        for(const instance of this.proofCtx.instances) {
            const subproofCtx = this.subproofsCtx[instance.subproofId];
            const airCtx = subproofCtx.airsCtx[instance.airId];
            const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);
            await this.provers[proverId].commitStage(stageId, subproofCtx.proofCtx, instance);
        }
        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.air.name}' Commiting stage ${stageId}.`);
        //             const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.air.numRows);

        //             await this.provers[id].commitStage(stageId, airInstanceCtx);
        //         }
        //     }
        // }
        return PROVER_OPENINGS_PENDING;
    }

    async openingStage(openingId) {
        for(const instance of this.proofCtx.instances) {
            const subproofCtx = this.subproofsCtx[instance.subproofId];
            const airCtx = subproofCtx.airsCtx[instance.airId];
            const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);

            return await this.provers[proverId].openingStage(openingId, subproofCtx.proofCtx, instance);
        }


        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.air.name}' Commiting stage ${openingId}.`);
        //             const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.air.numRows);

        //             return await this.provers[id].openingStage(openingId, airInstanceCtx);
        //         }
        //     }
        // }
    }

    computeProofChallenge(stageId) {
        //TODO !!!
        const challenge = this.proofCtx.instances[0].ctx.challenges[stageId];
        this.proofSharedMemory.setChallenge(stageId, challenge);

        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.air.name}' Computing proof challenge for stage ${stageId}.`);
        //             this.proofSharedMemory.setChallenge(stageId, this.prover.computeProofChallenge(stageId, airInstanceCtx));
        //         }
        //     }
        // }
    }

    setChallenges(stageId, challenge) {
        log.info(`[${this.name}]`, `··· Setting challenges for stage ${stageId}`);

        for(const instance of this.proofCtx.instances) {
            const subproofCtx = this.subproofsCtx[instance.subproofId];
            const airCtx = subproofCtx.airsCtx[instance.airId];
            const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);
            this.provers[proverId].setChallenges(stageId, instance, challenge);

        }

        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.air.numRows);
                    
        //             this.provers[id].setChallenges(stageId, airInstanceCtx, challenge);
        //         }
        //     }
        // }
    }

}

module.exports = {
    ProversManager,
    PROVER_OPENINGS_PENDING,
    PROVER_OPENINGS_COMPLETED
};
