const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const {
    ProversManager,
    PROVER_OPENINGS_COMPLETED,
    PROVER_OPENINGS_PENDING,
} = require("./provers_manager.js");

const CheckerFactory = require("./checker_factory.js");
const { AirOut } = require("./airout.js");
const ProofCtx = require("./proof_ctx.js");

const { fileExists } = require("./utils.js");
const path = require("path");

const FiniteFieldFactory = require("./finite_field_factory.js");

const log = require("../logger.js");

module.exports = class ProofOrchestrator {
    constructor(name) {
        this.initialized = false;

        this.name = name ?? "ProofOrchestrator";
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
         * - checker: prover type
         * - setup: setup data
         */
        if (!await proofManagerConfigIsValid(proofConfig)) {
            log.error(`[${this.name}]`, "Invalid proofManagerConfig.");
            throw new Error("Invalid proofManagerConfig.");
        }
        this.proofManagerConfig = proofConfig;

        this.airout = new AirOut(this.proofManagerConfig.airout.airoutFilename, this.proofManagerConfig.airout.airoutProto);

        // Create the finite field object
        const finiteField = FiniteFieldFactory.createFiniteField(this.airout.airout.baseField);

        // TODO change this, I did it to maintain compatibility with pil2-stark code
        for( let i = 0; i < this.airout.airout.subproofs.length; i++) {
            for( let j = 0; j < this.airout.airout.subproofs[i].airs.length; j++) {
                // this.airout.airout.subproofs[i].airs[j].symbols = this.airout.airout.symbols.filter(symbol => symbol.subproofId === i && symbol.airId === j);
                // this.airout.airout.subproofs[i].airs[j].numChallenges = this.airout.airout.numChallenges;

                // TODO change this
                this.airout.airout.subproofs[i].airs[j].symbols = this.airout.airout.symbols;
                this.airout.airout.subproofs[i].airs[j].hints = this.airout.airout.hints;
                this.airout.airout.subproofs[i].airs[j].numChallenges = this.airout.airout.numChallenges;
            }
        }

        const proofCtx = ProofCtx.createProofCtxFromAirout(
            this.proofManagerConfig.name,
            this.airout,
            finiteField
        );
        this.proofCtx = proofCtx;
        this.subproofsCtx = proofCtx.subproofsCtx;
        
        this.wcManager = new WitnessCalculatorManager(proofCtx);
        await this.wcManager.initialize(proofConfig.witnessCalculators, this.options);

        this.proversManager = new ProversManager(proofCtx);
        await this.proversManager.initialize(this.proofManagerConfig.prover, this.airout, this.options);

        this.checker = await CheckerFactory.createChecker(proofConfig.checker.filename);
        this.checker.initialize(proofConfig.checker.settings, this.options);        

        this.wcManager.proofCtx = proofCtx;
        this.wcManager.subproofsCtx = proofCtx.subproofsCtx;

        this.proversManager.proofCtx = proofCtx;
        this.proversManager.subproofsCtx = proofCtx.subproofsCtx;

        this.initialized = true;
        log.info(`[${this.name}]`, `< Initialized`);
        
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

            const checkerFilename =  path.join(__dirname, "..", proofManagerConfig.checker.filename);

            if (!await fileExists(checkerFilename)) {
                log.error(`[${this.name}]`, `Checker ${checkerFilename} does not exist.`);
                return false;
            }
            proofManagerConfig.checker.filename = checkerFilename;

            return true;
        }
    }

    async verifyPil(publics) {
        this.checkInitialized();

        try {
            await this.proversManager.setup();

            await this.newProof(publics);

            await this.wcManager.witnessComputation(1, publics);

            let result = true;
            for (const instance of this.proofCtx.instances) {
                const proverId = this.proversManager.getProverIdFromInstance(instance);

                result = result && await this.proversManager.provers[proverId].verifyPil(instance, publics);

                const airCtx = this.proofCtx.subproofsCtx[instance.subproofId].airsCtx[instance.airId];
                if (result === false) {
                    log.error(`[${this.name}]`, `PIL verification failed for subproof ${instance.subproofId} and air ${instance.airId} with N=${airCtx.layout.numRows} rows.`);
                    break;
                }
            }
            
            if(result) {
                log.info(`[${this.name}]`, `PIL verification successful.`);
            } else {
                log.error(`[${this.name}]`, `PIL verification failed.`);
            }
        } catch (error) {
            log.error(`[${this.name}]`, `Error while verifying PIL: ${error}`);
            throw error;
        } finally {
            this.finalizeProve();
        }
    }

    async newProof(publics) {
        this.proofCtx.initialize(publics);
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                airCtx.instances = [];
            }
        }
    }

    async generateProof(publics) {
        this.checkInitialized();

        try {
            log.info(`[${this.name}]`, `==> STARTING GENERATION OF THE PROOF '${this.proofManagerConfig.name}'.`);

            await this.proversManager.setup();

            await this.newProof(publics);

            let proverStatus = PROVER_OPENINGS_PENDING;
            for (let stageId = 1; proverStatus !== PROVER_OPENINGS_COMPLETED; stageId++) {
                let str = stageId <= this.airout.numStages + 1 ? "STAGE" : "OPENINGS";
                log.info(`[${this.name}]`, `==> ${str} ${stageId}`);

                await this.wcManager.witnessComputation(stageId, publics);

                proverStatus = await this.proversManager.computeStage(stageId, publics, this.options);

                log.info(`[${this.name}]`, `<== ${str} ${stageId}`);
            }

            log.info(`[${this.name}]`, `<== PROOF '${this.proofManagerConfig.name}' SUCCESSFULLY GENERATED.`);
            console.log();
        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve();
        }

        let proofs = [];

        for(let i = 0; i < this.proofCtx.challenges.length; i++) {
            if(this.proofCtx.challenges[i].length > 0) {
                for(let j = 0; j < this.proofCtx.challenges[i].length; j++) {
                    log.info(`[${this.name}]`, `!!! challenge ${i}: ${this.proofCtx.F.toString(this.proofCtx.challenges[i][j])}`);
                }
            }
        }

        for(const instance of this.proofCtx.instances) {
            instance.proof.subproofId = instance.subproofId;
            instance.proof.airId = instance.airId;
            proofs.push(instance.proof);
        }

        return {
            proofs,
            challenges: this.proofCtx.challenges.slice(0, this.airout.numStages + 3),
            challengesFRISteps: this.proofCtx.challenges.slice(this.airout.numStages + 3).map(c => c[0]),
        };

    }

    finalizeProve() {
        // TODO Finalize airout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }
}