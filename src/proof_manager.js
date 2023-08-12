const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const ProverFactory = require("./prover_factory.js");
const CheckerFactory = require("./checker_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const { PilOut } = require("./pilout.js");
const createProofContexts = require("./global_ctx.js");

const log = require("../logger.js");
const { fileExists } = require("./utils.js");
const path = require("path");

class ProofManager {
    constructor() {
        this.initialized = false;
    }

    initialize(name, settings) {
        if (this.initialized) {
            log.error("[ProofManager]", "Already initialized.");
            throw new Error("ProofManager already initialized.");
        }

        this.name = name;
        this.settings = settings;

        log.info("[ProofManager]", `${name} initialized.`);
        this.initialized = true;
    }

    checkInitialized() {
        if(!this.initialized) {
            log.error("[ProofManager]", `Not initialized.`);
            throw new Error(`[ProofManager] Not initialized.`);
        }
    }

    getName() {
        this.checkInitialized();
        return this.name;
    }

    async prove(provingSchema, options) {
        this.checkInitialized();

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
            log.error("[ProofManager]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        if (!await validateFileNameCorrectness(provingSchema)) {
            log.error("[ProofManager]", "Invalid provingSchema.");
            throw new Error("Invalid provingSchema.");
        }

        let proof;
        try {
            await this.initializeProve(provingSchema, options);

            proof = this.generateProof(provingSchema, options);
        } catch (error) {
            log.error("[ProofManager]", `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve(provingSchema, options);
        }

        return proof;

        async function provingSchemaIsValid(provingSchema) {
            if (provingSchema.name === undefined) {
                provingSchema.name = "proof-" + Date.now();
                log.warn("[ProofManager]", `No name provided in the provingSchema, assigning a default name ${provingSchema.name}.`);
            }

            const fields = ["pilout", "witnessCalculators", "prover", "setup"];
            for (const field of fields) {
                if (provingSchema[field] === undefined) {
                    log.error("[ProofManager]", `No ${field} provided in the provingSchema.`);
                    return false;
                }
            }

            return true;
        }

        async function validateFileNameCorrectness(provingSchema) {
            const piloutFilename =  path.join(__dirname, "..", provingSchema.pilout.piloutFilename);
            if (!await fileExists(piloutFilename)) {
                log.error("[ProofManager]", `Pilout ${piloutFilename} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutFilename = piloutFilename;

            const piloutProto =  path.join(__dirname, "..", provingSchema.pilout.piloutProto);
            if (!await fileExists(piloutProto)) {
                log.error("[ProofManager]", `Pilout proto ${piloutProto} does not exist.`);
                return false;
            }
            provingSchema.pilout.piloutProto = piloutProto;

            for(const witnessCalculator of provingSchema.witnessCalculators) {
                const witnessCalculatorLib =  path.join(__dirname, "..", witnessCalculator.witnessCalculatorLib);

                if (!await fileExists(witnessCalculatorLib)) {
                    log.error("[ProofManager]", `WitnessCalculator ${witnessCalculator.witnessCalculatorLib} does not exist.`);
                    return false;
                }
                witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
            }                
    
            const proverLib =  path.join(__dirname, "..", provingSchema.prover.proverLib);

            if (!await fileExists(proverLib)) {
                log.error("[ProofManager]", `Prover ${provingSchema.prover.proverLib} does not exist.`);
                return false;
            }
            provingSchema.prover.proverLib = proverLib;

            if (provingSchema.setup === undefined) {
                log.error("[ProofManager]", "No setup provided in the provingSchema.");
                return false;
            }

            const checkerLib =  path.join(__dirname, "..", provingSchema.checker.checkerLib);

            if (!await fileExists(checkerLib)) {
                log.error("[ProofManager]", `Checker ${provingSchema.checker.checkerLib} does not exist.`);
                return false;
            }
            provingSchema.checker.checkerLib = checkerLib;

            return true;
        }

    }

    async initializeProve(provingSchema, options) {
        this.pilout = new PilOut(provingSchema.pilout.piloutFilename, provingSchema.pilout.piloutProto, options);

        const { proofCtx, subproofsCtx } = createProofContexts(this.pilout);
        this.proofCtx = proofCtx;
        this.subproofsCtx = subproofsCtx;

        // Initialize the witnessCalculators
        if (provingSchema.witnessCalculators.length === 0) {
            log.error("[ProofManager]", "No witnessCalculators provided in the provingSchema.");
            throw new Error("No witnessCalculators provided in the provingSchema.");
        }

        const proofmanagerAPI = new ProofManagerAPI(this);
        this.wcManager = new WitnessCalculatorManager(proofmanagerAPI);
        this.wcManager.initialize();

        for(const witnessCalculator of provingSchema.witnessCalculators) {
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(witnessCalculator.witnessCalculatorLib, proofmanagerAPI);
            newWitnessCalculator.initialize(witnessCalculator.settings);

            this.wcManager.registerWitnessCalculator(newWitnessCalculator);
        }

        this.prover = await ProverFactory.createProver(provingSchema.prover.proverLib, proofmanagerAPI);
        this.prover.initialize(provingSchema.prover.settings);

        this.checker = await CheckerFactory.createChecker(provingSchema.checker.checkerLib, proofmanagerAPI);
        this.checker.initialize(provingSchema.checker.settings);

        // TODO Initialize setup

    }

    generateProof(provingSchema, options) {
        log.info("[ProofManager]", `--> Initiating the generation of the proof '${provingSchema.name}'.`
        );

        const proof = {};

        // TODO uncomment this when the compiler is working
        //for(let i = 0; i < this.pilout.numStages; i++) {
        for(let stageId = 1; stageId <= 4; stageId++) {
            log.info("[ProofManager]", `==> STAGE ${stageId}`);
            
            for(let subproofId = 0; subproofId < this.pilout.numSubproofs; subproofId++) {
                const subproof = this.pilout.getSubproofById(subproofId);

                log.info("[ProofManager]", `--> Subproof '${subproof.name}' witness computation stage ${stageId}`);

                for(let airId = 0; airId < subproof.airs.length; airId++) {
                    this.wcManager.witnessComputation(stageId, subproofId, airId);
                }

                log.info("[ProofManager]", `<-- Subproof '${subproof.name}' witness computation stage ${stageId}`);
            }

            this.prover.commitStage(stageId, proof);
            
            log.info("[ProofManager]", `<== STAGE ${stageId} finished`);
        }

        this.prover.computeQ(proof);

        this.prover.computeOpenings(proof);

        this.prover.finalizeProof(proof);

        log.info("[ProofManager]", `<-- Proof '${provingSchema.name}' successfully generated.`);

        return proof;
    }

    finalizeProve(provingSchema, options) {
        // TODO Finalize pilout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    allocateNewBuffer(subproofId, airId, numRows, nPolsBaseField, nPolsExtension) {
        if (this.pilout.pilout.subproofs[subproofId] === undefined ||
            this.pilout.pilout.subproofs[subproofId][airId])
            return { result: false, data: undefined };

        if(this.subproofsCtx[subproofId].airs[airId] === undefined) this.subproofsCtx[subproofId].airs[airId] = [];

        // TODO check if this is the best way to compute the reserved buffer size
        // TODO reserve buffer type depending on the baseField
        // TODO in the mear future extension will be provided by pilout, now it's harcoded for testing
        const sizeOneRowBytes = (nPolsBaseField + nPolsExtension * this.proofCtx.blowupFactor) * this.proofCtx.F.n8;

        const idx = this.subproofsCtx[subproofId].airs[airId].length;
        this.subproofsCtx[subproofId].airs[airId].push({
            idx,
            numRows: numRows,
            buffer: new Uint8Array(sizeOneRowBytes * numRows, { maxByteLength: sizeOneRowBytes * numRows + 1}),
            offset: sizeOneRowBytes,
        });
        return { result: true, data: this.subproofsCtx[subproofId].airs[airId][idx] };
    }

    // Reallocate the buffer for the given subproofId and airId with the given numRows.
    reallocateBuffer(subproofId, airId, idx, numRows) {
        const air = this.pilout.getAirBySubproofIdAirId(subproofId, airId);

        if(air === undefined) return { result: false, data: undefined };

        const buffer = this.subproofsCtx[subproofId].airs[airId][idx];
        const factor = buffer.numRows / numRows;
        //TODO change this to a more efficient way...resize??? it's not working, why?
        buffer.buffer = buffer.buffer.slice(0, buffer.buffer.byteLength / factor);
        //buffer.buffer.resize(buffer.buffer.byteLength / factor);
        return { result: true, data: buffer };
    }

    // Free the buffer for the given subproofId and airId.
    freeBuffer(subproofId, airId) {
        const air = this.pilout.getAirBySubproofIdAirId(subproofId, airId);

        if(air === undefined) return;

        if(this.subproofsCtx[subproofId] === undefined ||
           this.subproofsCtx[subproofId].airs[airId] === undefined) return;

        delete this.subproofsCtx[subproofId].airs[airId];
        return;
    }
}

module.exports = ProofManager;
