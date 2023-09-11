const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const ProverFactory = require("./prover_factory.js");
const CheckerFactory = require("./checker_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const { PilOut } = require("./pilout.js");
const proofContextFromPilout = require("./proof_ctx.js");
const { newCommitPolsArrayPil2, newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");

const { fileExists } = require("./utils.js");
const path = require("path");

const log = require("../logger.js");

class ProofManager {
    constructor(name) {
        this.initialized = false;

        this.name = name ?? "ProofManager";
    }

    async initialize(proofManagerConfig) {
        if (this.initialized) {
            log.error("`[${this.name}]`", "Already initialized.");
            throw new Error("ProofManager already initialized.");
        }

        /*
         * settings is a JSON object containing the following fields:
         * - name: name of the proof
         * - pilout: pilout of the proof
         * - witnessCalculators: array of witnessCalculator types
         * - prover: prover 
         * - checker: prover type
         * - setup: setup data
         */
        if (!await proofManagerConfigIsValid(proofManagerConfig)) {
            log.error(`[${this.name}]`, "Invalid proofManagerConfig.");
            throw new Error("Invalid proofManagerConfig.");
        }
        this.proofManagerConfig = proofManagerConfig;

        const proofmanagerAPI = new ProofManagerAPI(this);
        this.wcManager = new WitnessCalculatorManager(proofmanagerAPI);
        this.wcManager.initialize();

        for(const witnessCalculator of proofManagerConfig.witnessCalculators) {
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(witnessCalculator.witnessCalculatorLib, proofmanagerAPI);
            newWitnessCalculator.initialize(witnessCalculator.settings);

            this.wcManager.registerWitnessCalculator(newWitnessCalculator);
        }

        this.prover = await ProverFactory.createProver(proofManagerConfig.prover.filename, proofmanagerAPI);
        this.prover.initialize(proofManagerConfig.prover.settings);

        this.checker = await CheckerFactory.createChecker(proofManagerConfig.checker.filename, proofmanagerAPI);
        this.checker.initialize(proofManagerConfig.checker.settings);        

        this.initialized = true;
        log.info(`[${this.name}]`, `${this.name} initialized.`);

        return;

        async function proofManagerConfigIsValid(proofManagerConfig) {
            const fields = ["pilout", "witnessCalculators", "prover", "setup"];
            for (const field of fields) {
                if (proofManagerConfig[field] === undefined) {
                    log.error(`[${this.name}]`, `No ${field} provided in the proofManagerConfig.`);
                    return false;
                }
            }

            if (proofManagerConfig.name === undefined) {
                proofManagerConfig.name = "proof-" + Date.now();
                log.warn(`[${this.name}]`, `No name provided in the proofManagerConfig, assigning a default name ${proofManagerConfig.name}.`);
            }

            if (proofManagerConfig.witnessCalculators.length === 0) {
                log.error(`[${this.name}]`, "No witnessCalculators provided in the proofManagerConfig.");
                return false;
            }
    
            if (!await validateFileNameCorrectness(proofManagerConfig)) {
                log.error(`[${this.name}]`, "Invalid proofManagerConfig.");
                return false;
            }
    
            return true;
        }

        async function validateFileNameCorrectness(proofManagerConfig) {
            const piloutFilename =  path.join(__dirname, "..", proofManagerConfig.pilout.piloutFilename);
            if (!await fileExists(piloutFilename)) {
                log.error(`[${this.name}]`, `Pilout ${piloutFilename} does not exist.`);
                return false;
            }
            proofManagerConfig.pilout.piloutFilename = piloutFilename;

            const piloutProto =  path.join(__dirname, "..", proofManagerConfig.pilout.piloutProto);
            if (!await fileExists(piloutProto)) {
                log.error(`[${this.name}]`, `Pilout proto ${piloutProto} does not exist.`);
                return false;
            }
            proofManagerConfig.pilout.piloutProto = piloutProto;

            for(const witnessCalculator of proofManagerConfig.witnessCalculators) {
                const witnessCalculatorLib =  path.join(__dirname, "..", witnessCalculator.filename);

                if (!await fileExists(witnessCalculatorLib)) {
                    log.error(`[${this.name}]`, `WitnessCalculator ${witnessCalculator.filename} does not exist.`);
                    return false;
                }
                witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
            }                
    
            const proverFilename =  path.join(__dirname, "..", proofManagerConfig.prover.filename);

            if (!await fileExists(proverFilename)) {
                log.error(`[${this.name}]`, `Prover ${proverFilename} does not exist.`);
                return false;
            }
            proofManagerConfig.prover.filename = proverFilename;

            if (proofManagerConfig.setup === undefined) {
                log.error(`[${this.name}]`, "No setup provided in the proofManagerConfig.");
                return false;
            }

            const checkerFilename =  path.join(__dirname, "..", proofManagerConfig.checker.filename);

            if (!await fileExists(checkerFilename)) {
                log.error(`[${this.name}]`, `Checker ${checkerFilename} does not exist.`);
                return false;
            }
            proofManagerConfig.checker.filename = checkerFilename;

            return true;
        }
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, `Not initialized.`);
            throw new Error(`[ProofManager] Not initialized.`);
        }
    }

    async prove(options) {
        this.checkInitialized();

        let proof;

        try {
            await this.initializeProve(options);

            proof = await this.generateProof(options);

            if(options.verify) {
                const airInstance = this.subproofsCtx[0].airsCtx[0].instances[0];

                const isValid = await this.checker.checkProof(airInstance.proof, 0, 0, this.proofCtx, this.subproofsCtx[0]);

                if(isValid == false) {
                    log.error(`[${this.name}]`, `Proof for subproof ${this.subproofsCtx[0].name} is invalid`);        
                } else {
                    log.info(`[${this.name}]`, `Proof for subproof ${this.subproofsCtx[0].name} is valid`);
                }
            }
        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve(options);
        }

        return proof;
    }

    async initializeProve(options) {
        this.pilout = new PilOut(this.proofManagerConfig.pilout.piloutFilename, this.proofManagerConfig.pilout.piloutProto, options);

        // TODO change this, I did it to maintain compatibility with pil2-stark code
        for( let i = 0; i < this.pilout.pilout.subproofs.length; i++) {
            for( let j = 0; j < this.pilout.pilout.subproofs[i].airs.length; j++) {
                this.pilout.pilout.subproofs[i].airs[j].symbols = this.pilout.pilout.symbols.filter(symbol => symbol.subproofId === i && symbol.airId === j);
                this.pilout.pilout.subproofs[i].airs[j].numChallenges = this.pilout.pilout.numChallenges;
            }
        }
        
        // TODO change this
        const { proofCtx, subproofsCtx } = proofContextFromPilout(this.pilout);
        this.proofCtx = proofCtx;
        this.subproofsCtx = subproofsCtx;
    }

    async generateProof(options) {
        log.info(`[${this.name}]`, `--> Initiating the generation of the proof '${this.proofManagerConfig.name}'.`);

        // [Executor] Compute trace columns values
        log.info(`[${this.name}]`, `==> STAGE 0`);
        await this.computeWitnessStage(0);
        log.info(`[${this.name}]`, `<== STAGE 0`);

        // [Prover] Proof setup
        await this.setupProof();

        // [Executor] Compute witness for all stages
        let stageId;
        for (stageId = 1; stageId <= this.pilout.numStages + 1; stageId++) {
            log.info(`[${this.name}]`, `==> STAGE ${stageId}`);

            if (stageId !== 1) {
                this.setChallenges(stageId, this.proofCtx.challenges[stageId - 2]);
            }

            await this.computeWitnessStage(stageId);

            // TODO change... this is not the right place to do this
            if (stageId !== this.pilout.numStages + 1) {
                await this.commitStage(stageId);
            }

            // [Prover Manager] Compute challenges for all witness computations stages
            this.proofCtx.challenges[stageId - 1] = await this.computeChallenges(stageId);

            log.info(`[${this.name}]`, `<== STAGE ${stageId} finished`);
        }

        // [Prover] Call essential functions post-witness computation to produce a proof
        const proverCallbacks = this.prover.getProverCallbacks();

        for (let i = 0; i < proverCallbacks.length; i++) {
            this.setChallenges(stageId + i, this.proofCtx.challenges[stageId + i - 2]);

            await this.callProverCallback(proverCallbacks[i], stageId + i);

            // [Prover Manager] Compute challenges for all stages except the last one
            if (i !== proverCallbacks.length - 1) {
                this.proofCtx.challenges[stageId - 1] = await this.computeChallenges(stageId + i);
            }
        }

        log.info(`[${this.name}]`, `<-- Proof '${this.proofManagerConfig.name}' successfully generated.`);
    }

    async setupProof() {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    await this.prover.setupProof(subproofCtx, airCtx.airId, airInstanceCtx.instanceId);
                }
            }
        }
    }

    async computeWitnessStage(stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            log.info(`[${this.name}]`, `--> Subproof '${subproofCtx.name}' witness computation stage ${stageId}`);
            for (const airCtx of subproofCtx.airsCtx) {
                if(stageId === 0) {
                    await this.wcManager.witnessComputation(stageId, subproofCtx.subproofId, airCtx.airId, null, subproofCtx);
                } else {
                    for (const airInstanceCtx of airCtx.instances) {
                        log.info(`[ProofManager]`, `··· Air '${airCtx.name}' Computing witness for stage ${stageId}.`);
                        await this.wcManager.witnessComputation(stageId, subproofCtx.subproofId, airCtx.airId, airInstanceCtx.instanceId, subproofCtx);
                    }
                }
            }
            log.info(`[${this.name}]`, `<-- Subproof '${subproofCtx.name}' witness computation stage ${stageId}`);
        }
    }

    async commitStage(stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    log.info(`[ProofManager]`, `··· Air '${airCtx.name}' Commiting stage ${stageId}.`);
                    await this.prover.commitStage(stageId, airInstanceCtx);
                }
            }
        }
    }

    async callProverCallback(proverCallback, stageId) {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    await proverCallback(stageId, airInstanceCtx);
                }
            }
        }
    }

    finalizeProve(options) {
        // TODO Finalize pilout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }

    async computeChallenges(stageId) {
        log.info(`[${this.name}]`, `··· Computing challenges for stage ${stageId}`);

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    return await this.prover.computeChallenges(stageId, airInstanceCtx);
                }
            }
        }
    }

    setChallenges(stageId, challenge) {
        log.info(`[${this.name}]`, `··· Setting challenges for stage ${stageId}`);

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    this.prover.setChallenges(stageId, airInstanceCtx, challenge);
                }
            }
        }
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    addAirInstance(subproofCtx, airId, numRows) {
        const airCtx = subproofCtx.airsCtx[airId];

        if (airCtx === undefined) return { result: false, data: undefined };

        numRows = numRows ?? airCtx.numRows;
        const airInstanceCtx = subproofCtx.addAirInstance(airId, numRows);

        let air = this.pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);
        let airSymbols = this.pilout.pilout.symbols.filter(symbol => symbol.subproofId === subproofCtx.subproofId && symbol.airId === airId);

        airInstanceCtx.cnstPols = newConstantPolsArrayPil2(airSymbols, air.numRows, subproofCtx.F);
        airInstanceCtx.cmmtPols = newCommitPolsArrayPil2(airSymbols, air.numRows, subproofCtx.F);

        return { result: true, airInstanceCtx};
    }

    // Reallocate the buffer for the given subproofId and airId with the given numRows.
    resizeAirInstance(subproofCtx, airId, instanceId, numRows) {
        const airInstance = subproofCtx.airsCtx[airId].instances[instanceId];

        if(airInstance === undefined) return { result: false, data: undefined };

        const factor = airInstance.numRows / numRows;

        //TODO change this to a more efficient way...resize??? it's not working, why?
        airInstance.buffer = airInstance.buffer.slice(0, airInstance.buffer.byteLength / factor);
        //buffer.buffer.resize(buffer.buffer.byteLength / factor);
        return { result: true, airInstance };
    }

    // Free the buffer for the given subproofId and airId.
    removeAirInstance(subproofCtx, airId, instanceId) {
        if(subproofCtx.airs[airId] === undefined) return false;

        const airInstance = subproofCtx.airsCtx[airId].instances[instanceId];
        if(airInstance === undefined) return false;

        subproofCtx.airsCtx[airId].instances.splice(instanceId, 1);

        return true;
    }
}

module.exports = ProofManager;
