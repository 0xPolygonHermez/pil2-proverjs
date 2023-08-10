const log = require("../logger.js");
const { fileExists } = require("./utils.js");
const path = require("path");

const { WitnessCalculatorComposite } = require("./witness_calculator.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const ProverFactory = require("./prover_factory.js");
const VerifierFactory = require("./verifier_factory.js");
const PiloutproverAPI = require("./pilout_prover_api.js");
const { PilOut } = require("./pilout.js");

class PiloutProver {
    constructor() {
        this._initialized = false;
        this._isProving = false;
        if (PiloutProver.instance) {
            return PiloutProver.instance;
        }

        log.info("[Piloutprover]", "New instance created.");
        PiloutProver.instance = this;
    }

    initialize(name, settings) {
        if (this._initialized) {
            log.error("[Piloutprover]", "Already initialized.");
            throw new Error("Piloutprover already initialized.");
        }

        this._name = name;
        this._settings = settings;

        log.info("[Piloutprover]", `${name} initialized.`);
        this._initialized = true;
    }

    checkInitialized() {
        if(!this._initialized) {
            log.error("[Piloutprover]", `${this.name}: not initialized.`);
            throw new Error(`[Piloutprover] ${this.name}: not initialized.`);
        }
    }

    getName() {
        this.checkInitialized();
        return this._name;
    }

    async prove(provingSchema, options) {
        if (!this._initialized) {
            log.error("[Piloutprover]", "Piloutprover not initialized.");
            throw new Error("Piloutprover not initialized.");
        }

        if (this._isProving) {
            log.error("[Piloutprover]", "Piloutprover already generating a proof.");
            throw new Error("Piloutprover already generating a proof.");
        }

        // TODO must do it with a semaphore?
        this._isProving = true;

        /*
         * provingSchema is a JSON object containing the following fields:
         * - name: name of the proof
         * - pilout: pilout of the proof
         * - witnessCalculators: array of witnessCalculator types
         * - prover: prover type
         * - setup: setup data
         *
         */
        if (!await provingSchemaIsValid(provingSchema)) {
            this._isProving = false;

            log.error("[Piloutprover]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        if (!await ValidateFileNameCorrectness(provingSchema)) {
            this._isProving = false;

            log.error("[Piloutprover]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        let proof;
        try {
            await this.initializeProve(provingSchema, options);

            proof = this.generateProof(provingSchema, options);
        } catch (error) {
            log.error("[Piloutprover]", `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this._isProving = false;
            this.finalizeProve(provingSchema, options);
        }

        return proof;

        async function provingSchemaIsValid(provingSchema) {
            if (!provingSchema.name) {
                provingSchema.name = "proof-" + Date.now();
                log.warn("[Piloutprover]", `No name provided in the provingSchema, assigning a default name ${provingSchema.name}.`);
            }

            const fields = ["pilout", "witnessCalculators", "prover", "setup"];
            for (const field of fields) {
                if (!provingSchema[field]) {
                    log.error("[Piloutprover]", `No ${field} provided in the provingSchema.`);
                    return false;
                }
            }

            return true;
        }

        async function ValidateFileNameCorrectness(provingSchema) {
            const piloutFilename =  path.join(__dirname, "..", provingSchema.pilout.piloutFilename);
            if (!await fileExists(piloutFilename)) {
                log.error("[Piloutprover]", `Pilout ${piloutFilename} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutFilename = piloutFilename;

            const piloutProto =  path.join(__dirname, "..", provingSchema.pilout.piloutProto);
            if (!await fileExists(piloutProto)) {
                log.error("[Piloutprover]", `Pilout proto ${piloutProto} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutProto = piloutProto;

            for(const witnessCalculator of provingSchema.witnessCalculators) {
                const witnessCalculatorLib =  path.join(__dirname, "..", witnessCalculator.witnessCalculatorLib);

                if (!await fileExists(witnessCalculatorLib)) {
                    log.error("[Piloutprover]", `WitnessCalculator ${witnessCalculator.witnessCalculatorLib} does not exist.`);
                    return false;
                }
                witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
            }                
    
            const proverLib =  path.join(__dirname, "..", provingSchema.prover.proverLib);

            if (!await fileExists(proverLib)) {
                log.error("[Piloutprover]", `Prover ${provingSchema.prover.proverLib} does not exist.`);
                return false;
            }
            provingSchema.prover.proverLib = proverLib;

            if (!provingSchema.setup) {
                log.error("[Piloutprover]", "No setup provided in the provingSchema.");
                return false;
            }

            const verifierLib =  path.join(__dirname, "..", provingSchema.verifier.verifierLib);

            if (!await fileExists(verifierLib)) {
                log.error("[Piloutprover]", `Verifier ${provingSchema.verifier.verifierLib} does not exist.`);
                return false;
            }
            provingSchema.verifier.verifierLib = verifierLib;

            return true;
        }

    }

    async initializeProve(provingSchema, options) {
        this.pilout = new PilOut(provingSchema.pilout.piloutFilename, provingSchema.pilout.piloutProto, options);

        // Initialize the witnessCalculators
        if (provingSchema.witnessCalculators.length === 0) {
            log.error("[Piloutprover]", "No witnessCalculators provided in the provingSchema.");
            this._isProving = false;
            throw new Error("No witnessCalculators provided in the provingSchema.");
        }

        const piloutproverAPI = new PiloutproverAPI(this);
        this.witnessCalculators = new WitnessCalculatorComposite(piloutproverAPI);

        for(const witnessCalculator of provingSchema.witnessCalculators) {
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(witnessCalculator.witnessCalculatorLib, piloutproverAPI);
            newWitnessCalculator.initialize(witnessCalculator.settings);

            this.witnessCalculators.registerWitnessCalculator(newWitnessCalculator);
        }

        this.prover = await ProverFactory.createProver(provingSchema.prover.proverLib, piloutproverAPI);
        this.prover.initialize(provingSchema.prover.settings);

        this.verifier = await VerifierFactory.createVerifier(provingSchema.verifier.verifierLib, piloutproverAPI);
        this.verifier.initialize(provingSchema.verifier.settings);

        // TODO Initialize setup

    }

    generateProof(provingSchema, options) {
        log.info("[Piloutprover]", `--> Initiating the generation of the proof '${provingSchema.name}'.`
        );

        const proof = {};

        const nMockStages = 3;
        for(let i = 0; i < nMockStages; i++) {
            this.witnessCalculators.witnessComputation(i);

            this.prover.commitStage(i, proof);
        }

        this.prover.computeQ(proof);

        this.prover.computeOpenings(proof);

        this.prover.finalizeProof(proof);

        log.info("[Piloutprover]", `<-- Proof '${provingSchema.name}' successfully generated.`);

        return proof;
    }

    finalizeProve(provingSchema, options) {
        // TODO Finalize pilout
        if (this.witnessCalculators) delete this.witnessCalculators;
        // TODO Finalize prover
        // TODO Finalize setup
    }
}

module.exports = PiloutProver;
