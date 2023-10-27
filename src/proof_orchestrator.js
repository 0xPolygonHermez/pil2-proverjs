const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const {
    ProversManager,
    PROVER_OPENINGS_COMPLETED,
    PROVER_OPENINGS_PENDING,
} = require("./provers_manager.js");

const { AirOut } = require("./airout.js");
const ProofCtx = require("./proof_ctx.js");

const { fileExists } = require("./utils.js");
const path = require("path");

const FiniteFieldFactory = require("./finite_field_factory.js");

const log = require("../logger.js");

module.exports = class ProofOrchestrator {
    constructor(name) {
        this.initialized = false;

        this.name = name ?? "Proof Orch";
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error(`[${this.name}]`, `Not initialized.`);
            throw new Error(`[ProofOrchestrator] Not initialized.`);
        }
    }

    async initialize(proofConfig, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Proof Orchestrator already initialized.`);
        }

        log.info(`[${this.name}]`, "> Initializing...");

        this.options = options;

        /*
         * settings is a JSON object containing the following fields:
         * - name: name of the proof
         * - airout: airout of the proof
         * - witnessCalculators: array of witnessCalculator types
         * - prover: prover 
         * - setup: setup data
         */
        if (!await proofManagerConfigIsValid(proofConfig)) {
            log.error(`[${this.name}]`, "Invalid proofManagerConfig.");
            throw new Error("Invalid proofManagerConfig.");
        }
        this.proofManagerConfig = proofConfig;

        const airout = new AirOut(this.proofManagerConfig.airout.airoutFilename, this.proofManagerConfig.airout.airoutProto);

        for( let i = 0; i < airout.airout.subproofs.length; i++) {
            for( let j = 0; j < airout.airout.subproofs[i].airs.length; j++) {
                airout.airout.subproofs[i].airs[j].symbols = airout.airout.symbols.filter(symbol => (symbol.subproofId === undefined) || (symbol.subproofId === i && symbol.airId === j));
                //TODO next line must be with filter active
                airout.airout.subproofs[i].airs[j].hints = airout.airout.hints; //?.filter(hint => (hint.subproofId === undefined) || (hint.subproofId === i && hint.airId === j));
                airout.airout.subproofs[i].airs[j].numChallenges = airout.airout.numChallenges;
            }
        }

        // Create the finite field object
        const finiteField = FiniteFieldFactory.createFiniteField(airout.airout.baseField);
        this.proofCtx = ProofCtx.createProofCtxFromAirout(this.proofManagerConfig.name, airout, finiteField);
        
        this.wcManager = new WitnessCalculatorManager();
        await this.wcManager.initialize(proofConfig.witnessCalculators, this.proofCtx, this.options);

        this.proversManager = new ProversManager();
        await this.proversManager.initialize(proofConfig.prover, this.proofCtx, this.options);

        this.initialized = true;
        
        return;

        async function proofManagerConfigIsValid(proofManagerConfig) {
            const fields = ["airout", "witnessCalculators", "prover"];
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
    
            //TODO !!!!
            /// If setup exists check that it has a valid format

            return true;
        }

        async function validateFileNameCorrectness(proofManagerConfig) {
            const airoutFilename =  path.join(__dirname, "..", proofManagerConfig.airout.airoutFilename);
            if (!await fileExists(airoutFilename)) {
                log.error(`[${this.name}]`, `Airout ${airoutFilename} does not exist.`);
                return false;
            }
            proofManagerConfig.airout.airoutFilename = airoutFilename;

            const airoutProto =  path.join(__dirname, "..", proofManagerConfig.airout.airoutProto);
            if (!await fileExists(airoutProto)) {
                log.error(`[${this.name}]`, `Airout proto ${airoutProto} does not exist.`);
                return false;
            }
            proofManagerConfig.airout.airoutProto = airoutProto;

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

            if (proofManagerConfig.setup !== undefined) {
                // TODO
            }

            return true;
        }
    }

    async newProof(publics) {
        this.proofCtx.initialize(publics);
        for (const subproofCtx of this.proofCtx.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                airCtx.instances = [];
            }
        }
    }

    async generateProof(publics) {
        this.checkInitialized();

        let result;
        try {
            if(this.options.onlyCheck === undefined || this.options.onlyCheck === false) {
                log.info(`[${this.name}]`, `==> STARTING GENERATION OF THE PROOF '${this.proofManagerConfig.name}'.`);
            }


            await this.newProof(publics);

            let proverStatus = PROVER_OPENINGS_PENDING;
            for (let stageId = 1; proverStatus !== PROVER_OPENINGS_COMPLETED; stageId++) {
                let str = stageId <= this.proofCtx.airout.numStages + 1 ? "STAGE" : "OPENINGS";
                log.info(`[${this.name}]`, `==> ${str} ${stageId}`);

                await this.wcManager.witnessComputation(stageId, publics);

                if (stageId === 1) await this.proversManager.setup();

                proverStatus = await this.proversManager.computeStage(stageId, publics, this.options);

                log.info(`[${this.name}]`, `<== ${str} ${stageId}`);

                // If onlyCheck is true, we check the constraints stage by stage from stage1 to stageQ - 1 and do not generate the proof
                if(this.options.onlyCheck) {
                    log.info(`[${this.name}]`, `==> CHECKING CONSTRAINTS STAGE ${stageId}`);
                    result = true;
                    for (const instance of this.proofCtx.instances) {
                        const proverId = this.proversManager.getProverIdFromInstance(instance);
        
                        result = result && await this.proversManager.provers[proverId].verifyPil(stageId, instance);
        
                        const airCtx = this.proofCtx.subproofsCtx[instance.subproofId].airsCtx[instance.airId];
                        if (result === false) {
                            log.error(`[${this.name}]`, `PIL verification failed for subproof ${instance.subproofId} and air ${instance.airId} with N=${airCtx.layout.numRows} rows.`);
                            break;
                        }
                    }
                    
                    if(result) {
                        log.info(`[${this.name}]`, `Checking constraints successfully for stage ${stageId}.`);
                        log.info(`[${this.name}]`, `<== CHECKING CONSTRAINTS STAGE ${stageId}`);
                    } else {
                        log.error(`[${this.name}]`, `PIL verification failed at stage ${stageId}.`);
                        log.error(`[${this.name}]`, `<== CHECKING CONSTRAINTS STAGE ${stageId}`);
                        throw new Error(`[${this.name}]`, `PIL verification failed at stage ${stageId}.`);
                    }

                    if(stageId === this.proofCtx.airout.numStages) {
                        log.info(`[${this.name}]`, `<== CONSTRAINTS SUCCESSFULLY FULLFILLED.`);
                        return result;
                    }
                }
            }

            log.info(`[${this.name}]`, `<== PROOF '${this.proofManagerConfig.name}' SUCCESSFULLY GENERATED.`);
            console.log();

            let proofs = [];
    
            for(const instance of this.proofCtx.instances) {
                instance.proof.subproofId = instance.subproofId;
                instance.proof.airId = instance.airId;
                proofs.push(instance.proof);
            }
    
            return {
                proofs,
                challenges: this.proofCtx.challenges.slice(0, this.proofCtx.airout.numStages + 3),
                challengesFRISteps: this.proofCtx.challenges.slice(this.proofCtx.airout.numStages + 3).map(c => c[0]),
            };    
        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve();
        }
    }

    finalizeProve() {
        // TODO Finalize airout
        //if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }
}