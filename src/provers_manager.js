const ProverFactory = require("./prover_factory.js");
const { hashBTree } = require("./hash_binary_tree.js");

const log = require('../logger.js');
const { calculateHashStark } = require("pil2-stark-js");

const PROVER_OPENINGS_PENDING  = 1;
const PROVER_OPENINGS_COMPLETED = 2;

class ProversManager {
    constructor() {
        this.name = "ProversMan";

        this.initialized = false;
        this.provers = [];
    }

    getProverId(subproofId, airId, numRows) {
        return `${subproofId}-${airId}-${numRows}`;
    }

    getProverIdFromInstance(instance) {
        return this.getProverId(
            instance.subproofId,
            instance.airId,
            this.proofCtx.subproofsCtx[instance.subproofId].airsCtx[instance.airId].layout.numRows
        );
    }

    async initialize(config, proofCtx, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(
                `[${this.name}] Provers Manager already initialized.`
            );
        }

        this.proofCtx = proofCtx;
        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        for (let i = 0; i < proofCtx.airout.airout.subproofs.length; i++) {
            for (let j = 0; j < proofCtx.airout.airout.subproofs[i].airs.length; j++) {
                const prover = await ProverFactory.createProver(
                    config.filename,
                    this.proofCtx
                );

                const airName = proofCtx.airout.airout.subproofs[i].airs[j].name;
                const N = proofCtx.airout.airout.subproofs[i].airs[j].numRows;
                let settings =
                    config.settings[airName] ||
                    // proverConfig.settings[airName]?.default ||
                    config.settings.default;

                if (!settings) {
                    log.error(`[${this.name}]`, `No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                    throw new Error(`[${this.name}] No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                }

                prover.initialize(settings, options);

                const id = this.getProverId(i, j, proofCtx.airout.airout.subproofs[i].airs[j].numRows);

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

        for (const instance of this.proofCtx.instances) {
            const proverId = this.getProverIdFromInstance(instance);

            await this.provers[proverId].setup(instance);
        }
    }

    async newProof(publics) {
        this.checkInitialized();

        for (const subproofCtx of this.proofCtx.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                const id = this.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.layout.numRows);

                await this.provers[id].newProof(airCtx, publics);
            }
        }
    }

    async computeStage(stageId, publics, options) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing stage ${stageId}.`);

        if (stageId === 1) await this.newProof(publics);

        const numStages = this.proofCtx.getAirout().numStages + 1;
        const retValue =
            stageId <= numStages
                ? await this.commitStage(stageId)
                : await this.openingStage(stageId - numStages);

        if (retValue !== PROVER_OPENINGS_COMPLETED) {
            await this.computeProofChallenge(stageId, options);
            this.setChallenges(stageId, this.proofCtx.getChallenge(stageId));
        }

        log.info(`[${this.name}]`, `<-- Computing stage ${stageId}.`);

        return retValue;
    }

    async commitStage(stageId) {
        for (const instance of this.proofCtx.instances) {
            const proverId = this.getProverIdFromInstance(instance);

            await this.provers[proverId].commitStage(stageId, instance);
        }

        return PROVER_OPENINGS_PENDING;
    }

    async openingStage(openingId) {
        let state;
        for (const instance of this.proofCtx.instances) {
            const proverId = this.getProverIdFromInstance(instance);

            state = await this.provers[proverId].openingStage(openingId, instance);
        }

        return state;
    }

    async computeProofChallenge(stageId, options) {
        log.info(`[${this.name}]`, `··> Computing global challenge stage ${stageId + 1}`);

        if (stageId === 1) {
            for (let i = 0; i < this.proofCtx.subproofsCtx.length; i++) {
                let challengeArr = [];
                for (let j = 0; j < this.proofCtx.subproofsCtx[i].airsCtx.length; j++) {
                    const instances = this.proofCtx.getInstancesBySubproofIdAirId(i, j);
                    const airCtx = this.proofCtx.subproofsCtx[i].airsCtx[j];
                    for (let k = 0; k < instances.length; k++) {
                        log.info(
                            `[${this.name}]`,
                            `··· Computing global challenge. Adding constTree. Subproof '${this.proofCtx.subproofsCtx[i].name}' Air '${airCtx.name}' Instance ${instances[k].instanceId}`
                        );
    
                        challengeArr.push(instances[k].ctx.MH.root(airCtx.setup.constTree)); //TODO: Calculate one time
                    }
                }

                if (options.vadcop) {
                    const challenge = await hashBTree(challengeArr);
                    this.proofCtx.addChallengeToTranscript(challenge);
                } else {
                    this.proofCtx.addChallengeToTranscript(challengeArr[0]);
                }
            }

            let publicsCommits = [];

            const publics = Object.values(this.proofCtx.publics);

            if (options.hashCommits === true) {
                const publicsRoot = await calculateHashStark(
                    {
                        pilInfo: {
                            starkStruct: { verificationHashType: "GL" },
                        },
                    },
                    publics
                );
                publicsCommits.push(publicsRoot);
            } else {
                publicsCommits.push(...publics);
            }

            log.info(
                `[${this.name}]`,
                `··· Computing global challenge. Adding publics.`
            );

            this.proofCtx.addChallengeToTranscript(publicsCommits);
        }

        for (let i = 0; i < this.proofCtx.subproofsCtx.length; i++) {
            let challengeArr = [];
            for (let j = 0; j < this.proofCtx.subproofsCtx[i].airsCtx.length; j++) {
                const instancesCtx =
                    this.proofCtx.getInstancesBySubproofIdAirId(i, j);

                const airCtx = this.proofCtx.subproofsCtx[i].airsCtx[j];
                for (let k = 0; k < instancesCtx.length; k++) {
                    log.info(
                        `[${this.name}]`,
                        `··· Computing global challenge. Addings subproof '${this.proofCtx.subproofsCtx[i].name}' Air '${airCtx.name}' Instance ${instancesCtx[k].instanceId} value`
                    );

                    const value =
                        instancesCtx[k].ctx.challengeValue?.length > 0
                            ? instancesCtx[k].ctx.challengeValue
                            : [0];
                    challengeArr.push(...value);
                }
            }

            if (options.vadcop) {
                const challenge = await hashBTree(challengeArr);
                this.proofCtx.addChallengeToTranscript(challenge);
            } else {
                for (let k = 0; k < challengeArr.length; k++) {
                    this.proofCtx.addChallengeToTranscript(challengeArr[k]);
                }
            }
        }

        this.proofCtx.computeGlobalChallenge(stageId);

        log.info(`[${this.name}]`, `<·· Computing global challenge stage ${stageId + 1}`);
    }

    setChallenges(stageId, challenges) {
        for (const instance of this.proofCtx.instances) {
            instance.ctx.challenges[stageId] = challenges;
        }
    }
}

module.exports = {
    ProversManager,
    PROVER_OPENINGS_PENDING,
    PROVER_OPENINGS_COMPLETED
};
