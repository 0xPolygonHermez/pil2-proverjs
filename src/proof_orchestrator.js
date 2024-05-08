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

    async initialize(config, stepsFRI, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Proof Orchestrator already initialized.`);
        }

        log.info(`[${this.name}]`, "> Initializing...");

        this.options = options;

        /*
         * config is a JSON object containing the following fields:
         * - name: name of the proof
         * - airout: airout of the proof
         * - witnessCalculators: array of witnessCalculator types
         * - prover: prover 
         * - setup: setup data
         */
        if (!await configValid(config, this.name)) {
            log.error(`[${this.name}]`, "Invalid proof orchestrator config.");
            throw new Error("Invalid proof orchestrator config.");
        }
        this.config = config;

        const airout = new AirOut(this.config.airout.filename);

        // Create the finite field object
        const finiteField = FiniteFieldFactory.createFiniteField(airout.baseField);
        this.proofCtx = ProofCtx.createProofCtxFromAirout(this.config.name, airout, stepsFRI, finiteField);
        
        this.wcManager = new WitnessCalculatorManager();
        await this.wcManager.initialize(config.witnessCalculators, this.proofCtx, this.options);

        this.proversManager = new ProversManager();
        await this.proversManager.initialize(config.prover, this.proofCtx, this.options);

        this.initialized = true;
        
        return;

        async function configValid(config, name) {
            const fields = ["airout", "witnessCalculators", "prover"];
            for (const field of fields) {
                if (config[field] === undefined) {
                    log.error(`[${name}]`, `No ${field} provided in config.`);
                    return false;
                }
            }

            if (config.name === undefined) {
                config.name = "proof-" + Date.now();
                log.warn(`[${name}]`, `No name provided in config, assigning a default name ${config.name}.`);
            }

            if (config.witnessCalculators.length === 0) {
                log.error(`[${name}]`, "No witnessCalculators provided in config.");
                return false;
            }
    
            if (!await validateFileNameCorrectness(config)) {
                log.error(`[${name}]`, "Invalid config.");
                return false;
            }
    
            //TODO !!!!
            /// If setup exists check that it has a valid format

            return true;
        }

        async function validateFileNameCorrectness(config) {
            const airoutFilename = path.isAbsolute(config.airout.airoutFilename) ? config.airout.airoutFilename : path.join(__dirname, "..", config.airout.airoutFilename);
            if (!await fileExists(airoutFilename)) {
                log.error(`[${this.name}]`, `Airout ${airoutFilename} does not exist.`);
                return false;
            }
            config.airout.filename = airoutFilename;
            console.log(airoutFilename, config.airout.airoutFilename);


            for(const witnessCalculator of config.witnessCalculators) {
                const witnessCalculatorLib = path.isAbsolute(witnessCalculator.filename) ? witnessCalculator.filename : path.join(__dirname, "..", witnessCalculator.filename);

                if (!await fileExists(witnessCalculatorLib)) {
                    log.error(`[${this.name}]`, `WitnessCalculator ${witnessCalculator.filename} does not exist.`);
                    return false;
                }
                witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
            }                
    
            const proverFilename = path.isAbsolute(config.prover.filename) ? config.prover.filename : path.join(__dirname, "..", config.prover.filename);

            if (!await fileExists(proverFilename)) {
                log.error(`[${this.name}]`, `Prover ${proverFilename} does not exist.`);
                return false;
            }
            config.prover.proverFilename = proverFilename;

            if (config.setup !== undefined) {
                // TODO
            }

            return true;
        }
    }

    async newProof(publics) {
        await this.proofCtx.initialize(publics);
    }

    async generateProof(setup, publics) {
        this.checkInitialized();

        try {
            if(this.options.onlyCheck === undefined || this.options.onlyCheck === false) {
                log.info(`[${this.name}]`, `==> STARTING GENERATION OF THE PROOF '${this.config.name}'.`);
            }

            await this.newProof(publics);

            let proverStatus = PROVER_OPENINGS_PENDING;
            for (let stageId = 1; proverStatus !== PROVER_OPENINGS_COMPLETED; stageId++) {
                let str = stageId <= this.proofCtx.airout.numStages + 1 ? "STAGE" : "OPENINGS";
                log.info(`[${this.name}]`, `==> ${str} ${stageId}`);

                await this.wcManager.witnessComputation(stageId, publics);

                if (stageId === 1) await this.proversManager.setup(setup);

                proverStatus = await this.proversManager.computeStage(stageId, publics, this.options);

                log.info(`[${this.name}]`, `<== ${str} ${stageId}`);

                if(stageId === this.proofCtx.airout.numStages) {
                    for(let i = 0; i < this.proofCtx.airout.subproofs.length; i++) {
                        const subproof = this.proofCtx.airout.subproofs[i];
                        const subAirValues = subproof.subproofvalues;
                        if(subAirValues === undefined) continue;
                        const instances = this.proofCtx.airInstances.filter(airInstance => airInstance.subproofId === i);
                        for(let j = 0; j < subAirValues.length; j++) {
                            const aggType = subAirValues[j].aggType;
                            for(const instance of instances) {
                                const subproofValue = instance.ctx.subAirValues[j];
                                this.proofCtx.subAirValues[i][j] = aggType === 0 
                                    ? this.proofCtx.F.add(this.proofCtx.subAirValues[i][j], subproofValue) 
                                    : this.proofCtx.F.mul(this.proofCtx.subAirValues[i][j], subproofValue);
                            }
                        }
                    }
                }

                // If onlyCheck is true, we check the constraints stage by stage from stage1 to stageQ - 1 and do not generate the proof
                if(this.options.onlyCheck) {
                    log.info(`[${this.name}]`, `==> CHECKING CONSTRAINTS STAGE ${stageId}`);

                    const valid = await this.proversManager.verifyConstraints(stageId);
                    if(!valid) {
                        log.error(`[${this.name}]`, `Constraints verification failed.`);
                        throw new Error(`[${this.name}]`, `Constraints verification failed.`);
                    }

                    log.info(`[${this.name}]`, `<== CHECKING CONSTRAINTS STAGE ${stageId}`);

                    if(stageId === this.proofCtx.airout.numStages) {
                        log.info(`[${this.name}]`, `==> CHECKING GLOBAL CONSTRAINTS.`);

                        const validG = await this.proversManager.verifyGlobalConstraints();

                        if(!validG) {
                            log.error(`[${this.name}]`, `Global constraints verification failed.`);
                            throw new Error(`[${this.name}]`, `Global constraints verification failed.`);
                        }
                        
                        log.info(`[${this.name}]`, `<== CHECKING GLOBAL CONSTRAINTS.`);
                        return true;
                    }
                }
            }

            log.info(`[${this.name}]`, `<== PROOF '${this.config.name}' SUCCESSFULLY GENERATED.`);

            let proofs = [];
    
            for(const airInstance of this.proofCtx.airInstances) {
                airInstance.proof.subproofId = airInstance.subproofId;
                airInstance.proof.airId = airInstance.airId;
                proofs.push(airInstance.proof);
            }
    
            return {
                proofs,
                challenges: this.proofCtx.challenges.slice(0, this.proofCtx.airout.numStages + 3),
                challengesFRISteps: this.proofCtx.challenges.slice(this.proofCtx.airout.numStages + 3).map(c => c[0]),
                subAirValues: this.proofCtx.subAirValues,
            };

        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        }
    }
}
