const ProverFactory = require("./prover_factory.js");
const { hashBTree } = require("./hash_binary_tree.js");

const log = require('../logger.js');
const { calculateHashStark } = require("pil2-stark-js");
const { getGlobalConstraintsInfo } = require("pil2-stark-js/src/pil_info/getGlobalConstraintsInfo.js");

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

    getProverIdFromInstance(airInstance) {
        return this.getProverId(airInstance.subproofId, airInstance.airId, airInstance.layout.numRows);
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

        for(const subproof of proofCtx.airout.subproofs) {
            for(const air of subproof.airs) {
                const prover = await ProverFactory.createProver(config.filename, this.proofCtx);

                const airName = air.name;
                const N = air.numRows;
                let settings = config.settings[airName] || config.settings.default;

                if (!settings) {
                    log.error(`[${this.name}]`, `No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                    throw new Error(`[${this.name}] No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                }

                prover.initialize(settings, options);

                const proverId = this.getProverId(subproof.subproofId, air.airId, air.numRows);
                this.provers[proverId] = prover;
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

        for (const airInstance of this.proofCtx.airInstances) {
            const proverId = this.getProverIdFromInstance(airInstance);

            await this.provers[proverId].setup(airInstance);
        }

        this.proofCtx.constraintsCode = getGlobalConstraintsInfo(this.proofCtx.airout, true);
    }

    async newProof(publics) {
        this.checkInitialized();

        for(const subproof of this.proofCtx.airout.subproofs) {
            for(const air of subproof.airs) {
                const proverId = this.getProverId(subproof.subproofId, air.airId, air.numRows);

                await this.provers[proverId].newProof(subproof.subproofId, air.airId, publics);
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
        for (const airInstance of this.proofCtx.airInstances) {
            const proverId = this.getProverIdFromInstance(airInstance);

            await this.provers[proverId].commitStage(stageId, airInstance);
        }

        return PROVER_OPENINGS_PENDING;
    }

    async openingStage(openingId) {
        let state;
        for (const airInstance of this.proofCtx.airInstances) {
            const proverId = this.getProverIdFromInstance(airInstance);

            state = await this.provers[proverId].openingStage(openingId, airInstance);
        }

        return state;
    }

    async computeProofChallenge(stageId, options) {
        log.info(`[${this.name}]`, `··> Computing global challenge stage ${stageId + 1}`);

        if (stageId === 1) {
            for (const subproof of this.proofCtx.airout.subproofs) {
                let challengeArr = [];

                for(const air of subproof.airs) {
                    const airInstances = this.proofCtx.getAirInstancesBySubproofIdAirId(subproof.subproofId, air.airId);

                    for(const airInstance of airInstances) {
                        log.info(
                            `[${this.name}]`,
                            `··· Computing global challenge. Adding constTree. Subproof '${subproof.name}' Air '${air.name}' Instance ${airInstance.instanceId}`
                        );
    
                        challengeArr.push(airInstance.ctx.MH.root(air.setup.constTree)); //TODO: Calculate one time
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

        for(const subproof of this.proofCtx.airout.subproofs) {

            let challengeArr = [];
            for(const air of subproof.airs) {
                const airInstances = this.proofCtx.getAirInstancesBySubproofIdAirId(subproof.subproofId, air.airId);

                for(const airInstance of airInstances) {
                    log.info(
                        `[${this.name}]`,
                        `··· Computing global challenge. Addings subproof '${subproof.name}' Air '${air.name}' Instance ${airInstance.instanceId} value`);

                    const value = airInstance.ctx.challengeValue?.length > 0 ? airInstance.ctx.challengeValue : [0];
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
        for (const airInstance of this.proofCtx.airInstances) {
            airInstance.ctx.challenges[stageId] = challenges;
        }
    }
}

module.exports = {
    ProversManager,
    PROVER_OPENINGS_PENDING,
    PROVER_OPENINGS_COMPLETED
};
