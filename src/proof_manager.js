const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const ProverFactory = require("./prover_factory.js");
const CheckerFactory = require("./checker_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const { PilOut } = require("./pilout.js");
const proofContextFromPilout = require("./proof_ctx.js");
const PolsArray = require("./polsarray.js");
const { calculateChallengeStark } = require("../node_modules/pil2-stark-js/src/stark/stark_gen_helpers.js");

const { fileExists } = require("./utils.js");
const path = require("path");

const log = require("../logger.js");

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

            proof = await this.generateProof(provingSchema, options);

            if(options.verify) {
                const airInstance = this.subproofsCtx[0].airsCtx[0].instances[0];

                const isValid = await this.checker.checkProof(airInstance.proof, 0, 0, this.proofCtx, this.subproofsCtx[0]);

                if(isValid == false) {
                    log.error(`[${this.name}]`, `STARK proof for subproof ${this.subproofsCtx[0].name} is invalid`);        
                } else {
                    log.info(`[${this.name}]`, `STARK proof for subproof ${this.subproofsCtx[0].name} is valid`);
                }
            }
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
                const witnessCalculatorLib =  path.join(__dirname, "..", witnessCalculator.filename);

                if (!await fileExists(witnessCalculatorLib)) {
                    log.error("[ProofManager]", `WitnessCalculator ${witnessCalculator.filename} does not exist.`);
                    return false;
                }
                witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
            }                
    
            const proverFilename =  path.join(__dirname, "..", provingSchema.prover.filename);

            if (!await fileExists(proverFilename)) {
                log.error("[ProofManager]", `Prover ${proverFilename} does not exist.`);
                return false;
            }
            provingSchema.prover.filename = proverFilename;

            if (provingSchema.setup === undefined) {
                log.error("[ProofManager]", "No setup provided in the provingSchema.");
                return false;
            }

            const checkerFilename =  path.join(__dirname, "..", provingSchema.checker.filename);

            if (!await fileExists(checkerFilename)) {
                log.error("[ProofManager]", `Checker ${checkerFilename} does not exist.`);
                return false;
            }
            provingSchema.checker.filename = checkerFilename;

            return true;
        }

    }

    async initializeProve(provingSchema, options) {
        this.pilout = new PilOut(provingSchema.pilout.piloutFilename, provingSchema.pilout.piloutProto, options);

        const { proofCtx, subproofsCtx } = proofContextFromPilout(this.pilout);
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

        this.prover = await ProverFactory.createProver(provingSchema.prover.filename, proofmanagerAPI);
        this.prover.initialize(provingSchema.prover.settings);

        this.checker = await CheckerFactory.createChecker(provingSchema.checker.filename, proofmanagerAPI);
        this.checker.initialize(provingSchema.checker.settings);        
    }

    async generateProof(provingSchema, options) {
        log.info("[ProofManager]", `--> Initiating the generation of the proof '${provingSchema.name}'.`);

        // [Executor] Compute trace columns values
        log.info("[ProofManager]", `==> STAGE 0`);
        await this.computeWitnessStage(0);
        log.info("[ProofManager]", `<== STAGE 0`);

        // [Prover] Proof setup
        for(let subproofId = 0; subproofId < this.pilout.numSubproofs; subproofId++) {
            const subproof = this.pilout.getSubproofById(subproofId);

            for(let airId = 0; airId < subproof.airs.length; airId++) {
                const airCtx = this.subproofsCtx[subproofId].airsCtx[airId];

                for(let airInstanceId = 0; airInstanceId < airCtx.instances.length; airInstanceId++) {
                    await this.prover.setupProof(this.subproofsCtx[subproofId], subproofId, airId, airInstanceId);
                }
            }
        }

        // [Executor] Compute witness for all stages
        for(let stageId = 1; stageId <= this.pilout.numStages; stageId++) {
            log.info("[ProofManager]", `==> STAGE ${stageId}`);
            
            await this.computeWitnessStage(stageId);

            for (let subproofId = 0; subproofId < this.pilout.numSubproofs; subproofId++) {
                const subproof = this.pilout.getSubproofById(subproofId);
    
                for (let airId = 0; airId < subproof.airs.length; airId++) {
                    const air = this.pilout.getAirBySubproofIdAirId(subproofId, airId);
                    const airCtx = this.subproofsCtx[subproofId].airsCtx[airId];

                    for (let airInstanceId = 0; airInstanceId < airCtx.instances.length; airInstanceId++) {
                        log.info(`[ProofManager]`, `··· Air '${air.name}' Commiting stage ${stageId}.`);
                        await this.prover.commitStage(stageId, subproofId, airId, airInstanceId, this.proofCtx, this.subproofsCtx[subproofId]);
                    }
                }
            }

            // [Prover Manager] Compute challenges for all witness computations stages
            this.proofCtx.challenges[stageId - 1] = await this.computeChallenges(stageId);

            log.info("[ProofManager]", `<== STAGE ${stageId} finished`);
        }

        // [Prover] Call essential functions post-witness computation to produce a proof
        const proverCallbacks = this.prover.getProverCallbacks();

        for(let i= 0; i < proverCallbacks.length; i++) {
            for(let subproofId = 0; subproofId < this.pilout.numSubproofs; subproofId++) {
                const subproof = this.pilout.getSubproofById(subproofId);

                for(let airId = 0; airId < subproof.airs.length; airId++) {
                    const airCtx = this.subproofsCtx[subproofId].airsCtx[airId];

                    for(let airInstanceId = 0; airInstanceId < airCtx.instances.length; airInstanceId++) {
                        await proverCallbacks[i](subproofId, airId, airInstanceId, this.proofCtx, this.subproofsCtx[subproofId]);
                    }
                }
            }

            // [Prover Manager] Compute challenges for all stages except the last one
            if(i !== proverCallbacks.length - 1) {
                const nStage = this.pilout.numStages + i;
                this.proofCtx.challenges[nStage] = await this.computeChallenges(nStage + 1);
            }
        };

        log.info("[ProofManager]", `<-- Proof '${provingSchema.name}' successfully generated.`);
    }

    async computeWitnessStage(stageId) {
        for (let subproofId = 0; subproofId < this.pilout.numSubproofs; subproofId++) {
            const subproof = this.pilout.getSubproofById(subproofId);

            log.info("[ProofManager]", `--> Subproof '${subproof.name}' witness computation stage ${stageId}`);

            for (let airId = 0; airId < subproof.airs.length; airId++) {
                const air = this.pilout.getAirBySubproofIdAirId(subproofId, airId);

                log.info(`[ProofManager]`, `··· Air '${air.name}' Computing witness for stage ${stageId}.`);
                await this.wcManager.witnessComputation(stageId, subproofId, airId, this.proofCtx, this.subproofsCtx[subproofId]);
            }

            log.info("[ProofManager]", `<-- Subproof '${subproof.name}' witness computation stage ${stageId}`);
        }
    }

    finalizeProve(provingSchema, options) {
        // TODO Finalize pilout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }

    async computeChallenges(stageId) {
        log.info("[ProofManager]", `··· Computing challenges for stage ${stageId}`);

        const airInstance = this.subproofsCtx[0].airsCtx[0].instances[0];
        
        return await calculateChallengeStark(stageId, airInstance.ctx);
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    addAirInstance(subproofCtx, airId, numRows) {
        const airCtx = subproofCtx.airsCtx[airId];

        if (airCtx === undefined) return { result: false, data: undefined };

        numRows = numRows ?? airCtx.numRows;
        const airInstanceCtx = subproofCtx.addAirInstance(airId, numRows);

        let air = this.pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);
        let airSymbols = this.pilout.pilout.symbols.filter(symbol => symbol.subproofId === subproofCtx.subproofId && symbol.airId === airId);
        airInstanceCtx.constPols = this.getFixedPolsPil2(airSymbols, air, subproofCtx.proofCtx.F);
        airInstanceCtx.cmPols = this.newCommitPolsArrayPil2(airSymbols, air, subproofCtx.proofCtx.F);

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

    getFixedPolsPil2(symbols, pil, F) {
        const cnstPols = this.newConstantPolsArrayPil2(symbols, pil.numRows, F);
            
        for(let i = 0; i < cnstPols.$$defArray.length; ++i) {
            const def = cnstPols.$$defArray[i];
            const name = def.name;
            const [nameSpace, namePol] = name.split(".");
            const deg = def.polDeg;
            const fixedCols = pil.fixedCols[i];
            for(let j = 0; j < deg; ++j) {
                if(def.idx) {
                    cnstPols[nameSpace][namePol][def.idx][j] = buf2bint(fixedCols.values[j]);
                } else {
                    cnstPols[nameSpace][namePol][j] = buf2bint(fixedCols.values[j]);
                }
            }
        }
    
        return cnstPols;
    }
    
    // TODO: export it to feature/pil2_polsArray
    newCommitPolsArrayPil2(symbols, air, F) {
        const witnessSymbols = [];
        for (let i = 0; i < symbols.length; ++i) {
            if(symbols[i].type !== 3) continue;
            witnessSymbols.push({name: symbols[i].name, idx: symbols[i].id, length: symbols[i].length});
        }
    
        const pa = new PolsArray(witnessSymbols, air.numRows, "commit", F);
        return pa;
    }
    
    newConstantPolsArrayPil2(symbols, degree, F) {
        const fixedSymbols = [];
        for (let i = 0; i < symbols.length; ++i) {
            if(symbols[i].type !== 1) continue;
            fixedSymbols.push({name: symbols[i].name, idx: symbols[i].id, length: symbols[i].length});
        }
    
        const pa = new PolsArray(fixedSymbols, degree, "constant", F);
        return pa;
    }
    
    buf2bint(buf) {
        let value = 0n;
        let offset = 0;
        while ((buf.length - offset) >= 8) {
            value = (value << 64n) + (offset ? buf.readBigUInt64BE(offset):buf.readBigInt64BE(offset));
            offset += 8;
        }
        while ((buf.length - offset) >= 4) {
            value = (value << 32n) + (offset ? BigInt(buf.readUInt32BE(offset)) :BigInt(buf.readInt32BE(offset)));
            offset += 4;
        }
        while ((buf.length - offset) >= 2) {
            value = (value << 16n) + (offset ? BigInt(buf.readUInt16BE(offset)) : BigInt(buf.readInt16BE(offset)));
            offset += 2;
        }
        while ((buf.length - offset) >= 1) {
            value += (value << 8n) + (offset ? BigInt(buf.readUInt8(offset)) : BigInt(buf.readInt8(offset)));
            offset += 1;
        }
        return value;
    }
}

module.exports = ProofManager;
