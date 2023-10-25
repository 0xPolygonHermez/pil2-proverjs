const ProverFactory = require("./prover_factory.js");
const { hashBTree } = require("./hash_binary_tree.js");

const log = require('../logger.js');
const { calculateHashStark } = require("pil2-stark-js");

const PROVER_OPENINGS_PENDING  = 1;
const PROVER_OPENINGS_COMPLETED = 2;

class ProversManager {
    constructor(proofCtx) {
        this.name = "ProversManager";
        this.proofCtx = proofCtx;

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
                const prover = await ProverFactory.createProver(proverConfig.filename, this.proofCtx);

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

    async computeStage(stageId, publics, options) {
        const numStages = this.proofCtx.getAirout().numStages + 1;

        
        if(stageId === 1) {
            await this.newProof(publics);
        }
        
        if(stageId <= numStages) {
            await this.commitStage(stageId);
        } else {
            const retValue = await this.openingStage(stageId - numStages);
            if(retValue !== PROVER_OPENINGS_COMPLETED) {
                await this.computeProofChallenge(stageId, options);
                this.setChallenges(stageId, this.proofCtx.getChallenge(stageId));
            }
            return retValue;
        }
        
        await this.computeProofChallenge(stageId, options);

        this.setChallenges(stageId, this.proofCtx.getChallenge(stageId));

        return PROVER_OPENINGS_PENDING;
    }

    async commitStage(stageId) {
        for(const instance of this.proofCtx.instances) {
            const subproofCtx = this.subproofsCtx[instance.subproofId];
            const airCtx = subproofCtx.airsCtx[instance.airId];

            const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);
            await this.provers[proverId].commitStage(stageId, instance);
        }

        return PROVER_OPENINGS_PENDING;
    }

    async openingStage(openingId) {
        let state;
        for(const instance of this.proofCtx.instances) {
            const subproofCtx = this.subproofsCtx[instance.subproofId];
            const airCtx = subproofCtx.airsCtx[instance.airId];
            const proverId = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);

            // log.info(`[ProofOrchestrator]`, `··· Air '${airCtx.air.name}' Commiting stage ${openingId}.`);
            state = await this.provers[proverId].openingStage(openingId, subproofCtx.proofCtx, instance);
        }

        return state;
    }

    async computeProofChallenge(stageId, options) {
        if(stageId === 1) {
            for(let i = 0; i < this.subproofsCtx.length; i++) {
                let challengeArr = [];
                for(let j = 0; j < this.subproofsCtx[i].airsCtx.length; j++) {
                    const instancesCtx = this.proofCtx.getInstancesBySubproofIdAirId(i, j);
                    const airCtx = this.subproofsCtx[i].airsCtx[j];
                    for(let k = 0; k < instancesCtx.length; k++) {
                        log.info(`[ProofOrchestrator]`,
                            `··· SubproofCtx '${this.subproofsCtx[i].name}' Air '${airCtx.name}' Instance '${instancesCtx[k].instanceId}' Computing proof challenge for stage ${stageId}.`);
    
                        challengeArr.push(instancesCtx[k].ctx.MH.root(airCtx.setup.constTree)); //TODO: Calculate one time
                    }
                }

                if(options.vadcop) {
                    const challenge = await hashBTree(challengeArr);
                    this.proofCtx.addChallengeToTranscript(challenge);
                } else {
                    this.proofCtx.addChallengeToTranscript(challengeArr[0]);
                }
            }

            let publicsCommits = [];

            const publics = Object.values(this.proofCtx.publics);

            if(options.hashCommits === true) {
                const publicsRoot = await calculateHashStark({pilInfo: {starkStruct: {verificationHashType: "GL"}}}, publics);
                publicsCommits.push(publicsRoot);
            } else {
                publicsCommits.push(...publics);
            }
            
            this.proofCtx.addChallengeToTranscript(publicsCommits);
        }

        for(let i = 0; i < this.subproofsCtx.length; i++) {
            let challengeArr = [];
            for(let j = 0; j < this.subproofsCtx[i].airsCtx.length; j++) {
                const instancesCtx = this.proofCtx.getInstancesBySubproofIdAirId(i, j);
                
                const airCtx = this.subproofsCtx[i].airsCtx[j];
                for(let k = 0; k < instancesCtx.length; k++) {
                    log.info(`[ProofOrchestrator]`,
                        `··· SubproofCtx '${this.subproofsCtx[i].name}' Air '${airCtx.name}' Instance '${instancesCtx[k].instanceId}' Computing proof challenge for stage ${stageId}.`);

                    const value = instancesCtx[k].ctx.challengeValue && instancesCtx[k].ctx.challengeValue.length > 0 ? instancesCtx[k].ctx.challengeValue : [0];
                    challengeArr.push(...value);
                }
            }

            if(options.vadcop) {
                const challenge = await hashBTree(challengeArr);
                this.proofCtx.addChallengeToTranscript(challenge);
            } else {
                for(let k = 0; k < challengeArr.length; k++) {
                    this.proofCtx.addChallengeToTranscript(challengeArr[k]);
                }
            }
        }

        this.proofCtx.computeGlobalChallenge(stageId);
    }

    setChallenges(stageId, challenges) {
        log.info(`[${this.name}]`, `··· Setting challenges for stage ${stageId}`);

        for(const instance of this.proofCtx.instances) {
            instance.ctx.challenges[stageId] = challenges;
        }
    }

}

module.exports = {
    ProversManager,
    PROVER_OPENINGS_PENDING,
    PROVER_OPENINGS_COMPLETED
};
