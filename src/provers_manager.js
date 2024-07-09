const ProverFactory = require("./prover_factory.js");
const { hashBTree } = require("./hash_binary_tree.js");

const log = require('../logger.js');
const { calculateHashStark } = require("pil2-stark-js");
const { setSymbolCalculated } = require("pil2-stark-js/src/prover/symbols_helpers.js");

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
                const prover = await ProverFactory.createProver(config.proverFilename, this.proofCtx);

                const airName = air.name;
                const N = air.numRows;
                let settings = config.settings ? config.settings[airName] || config.settings.default || {} : {};

                if (!settings) {
                    log.error(`[${this.name}]`, `No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                    throw new Error(`[${this.name}] No settings for air '${airName}'${N ? ` with N=${N}` : ""}`);
                }

                prover.initialize(settings, N, options);

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

    async setup(setup) {
        this.checkInitialized();

        for (const airInstance of this.proofCtx.getAirInstances()) {
            const air = this.proofCtx.airout.getAirBySubproofIdAirId(airInstance.subproofId, airInstance.airId);
            air.setup = setup.setup[airInstance.subproofId][airInstance.airId];
        }

        if(this.proofCtx.airout.constraints !== undefined) {
            this.proofCtx.constraintsCode = setup.globalConstraints;
        }
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

    async verifyConstraints(stageId) {
        let result = true;

        for (const airInstance of this.proofCtx.getAirInstances()) {
            const proverId = this.getProverIdFromInstance(airInstance);

            result = result && await this.provers[proverId].verifyConstraints(stageId, airInstance);

            if (result === false) {
                log.error(`[${this.name}]`, `Constraints verification failed for subproof ${airInstance.subproofId} and air ${airInstance.airId} with N=${airInstance.layout.numRows} rows.`);
                break;
            }
        }

        return result;        
    }

    async verifyGlobalConstraints() {
        const proverId = this.getProverIdFromInstance(this.proofCtx.getAirInstancesBySubproofId(0)[0]);
        const validGlobalConstraints = await this.provers[proverId].verifyGlobalConstraints();
        
        if(!validGlobalConstraints) log.error(`[${this.name}]`, `Global constraints verification failed.`);
        
        return validGlobalConstraints;
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
        for (const airInstance of this.proofCtx.getAirInstances()) {
          const proverId = this.getProverIdFromInstance(airInstance);

          await this.provers[proverId].commitStage(stageId, airInstance);
        }

        return PROVER_OPENINGS_PENDING;
    }

    async openingStage(openingId) {
        let state;
        for (const airInstance of this.proofCtx.getAirInstances()) {
            const proverId = this.getProverIdFromInstance(airInstance);

            state = await this.provers[proverId].openingStage(openingId, airInstance);
        }

        return state;
    }

    async computeProofChallenge(stageId, options) {
        log.info(`[${this.name}]`, `··> Computing global challenge stage ${stageId}`);

        if (stageId === 1) {
            let publicValues;
            for (const subproof of this.proofCtx.airout.subproofs) {
                let challenges = [];

                for(const air of subproof.airs) {
                    const airInstances = this.proofCtx.getAirInstancesBySubproofIdAirId(subproof.subproofId, air.airId);

                    for(const airInstance of airInstances) {
                        log.info(
                            `[${this.name}]`,
                            `··· Computing global challenge. Adding constTree. Subproof '${subproof.name}' Air '${air.name}' Instance ${airInstance.instanceId}`
                        );
    
                        challenges.push(air.setup.constRoot);

                        if(!publicValues) {
                            publicValues = airInstance.ctx.publics;
                        }
                    }
                }

                if (options.inputChallenges) {
                    const challenge = await hashBTree(challenges);
                    this.proofCtx.addChallengeToTranscript(challenge);
                } else {
                    this.proofCtx.addChallengeToTranscript(challenges[0]);
                }
            }

            log.info(`[${this.name}]`, `··· Computing global challenge. Adding publics.`);

            this.proofCtx.addChallengeToTranscript(publicValues);
        }

        for(const subproof of this.proofCtx.airout.subproofs) {

            let challenges = [];
            for(const air of subproof.airs) {
                const airInstances = this.proofCtx.getAirInstancesBySubproofIdAirId(subproof.subproofId, air.airId);

                for(const airInstance of airInstances) {
                    log.info(
                        `[${this.name}]`,
                        `··· Computing global challenge. Addings subproof '${subproof.name}' Air '${air.name}' Instance ${airInstance.instanceId} value`);

                    const value = airInstance.ctx.challengeValue?.length > 0 ? airInstance.ctx.challengeValue : [];
                    challenges.push(...value);
                }
            }

            if (options.inputChallenges) {
                if(challenges.length > 0) {
                    const challenge = await hashBTree(challenges);
                    this.proofCtx.addChallengeToTranscript(challenge);
                }
            } else {
                for (let k = 0; k < challenges.length; k++) {
                    this.proofCtx.addChallengeToTranscript(challenges[k]);
                }
            }
        }

        this.proofCtx.computeGlobalChallenge(stageId);

        log.info(`[${this.name}]`, `<·· Computing global challenge stage ${stageId}`);
    }

    setChallenges(stageId, challenges) {
        for (const airInstance of this.proofCtx.getAirInstances()) {
          airInstance.ctx.challenges[stageId] = challenges;
          for (let i = 0; i < airInstance.ctx.pilInfo.challengesMap.length; i++) {
            if (airInstance.ctx.pilInfo.challengesMap[i].stage === stageId + 1) {
              setSymbolCalculated(
                airInstance.ctx,
                { op: "challenge", stageId: stageId + 1, id: i },
                this.options
              );
            }
          }
        }
    }
}

module.exports = {
    ProversManager,
    PROVER_OPENINGS_PENDING,
    PROVER_OPENINGS_COMPLETED
};
