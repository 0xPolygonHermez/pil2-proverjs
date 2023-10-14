const { WitnessCalculatorManager } = require("./witness_calculator_manager.js");
const {
    ProversManager,
    PROVER_OPENING_TASKS_COMPLETED,
    PROVER_OPENING_TASKS_PENDING,
} = require("./provers_manager.js");
const CheckerFactory = require("./checker_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const { PilOut } = require("./pilout.js");
const proofContextFromPilout = require("./proof_ctx.js");
const { newCommitPolsArrayPil2 } = require("pilcom/src/polsarray.js");

const { fileExists } = require("./utils.js");
const path = require("path");

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
         * - pilout: pilout of the proof
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

        const proofmanagerAPI = new ProofManagerAPI(this);

        this.pilout = new PilOut(this.proofManagerConfig.pilout.piloutFilename, this.proofManagerConfig.pilout.piloutProto);

        this.wcManager = new WitnessCalculatorManager(proofmanagerAPI, this.proofCtx, this.subproofsCtx);
        await this.wcManager.initialize(proofConfig.witnessCalculators, this.options);

        this.proversManager = new ProversManager(proofmanagerAPI, this.proofCtx, this.subproofsCtx);
        await this.proversManager.initialize(this.proofManagerConfig.prover, this.pilout, this.options);

        this.checker = await CheckerFactory.createChecker(proofConfig.checker.filename);
        this.checker.initialize(proofConfig.checker.settings, this.options);        

        // TODO change this, I did it to maintain compatibility with pil2-stark code
        for( let i = 0; i < this.pilout.pilout.subproofs.length; i++) {
            for( let j = 0; j < this.pilout.pilout.subproofs[i].airs.length; j++) {
                // this.pilout.pilout.subproofs[i].airs[j].symbols = this.pilout.pilout.symbols.filter(symbol => symbol.subproofId === i && symbol.airId === j);
                // this.pilout.pilout.subproofs[i].airs[j].numChallenges = this.pilout.pilout.numChallenges;

                // TODO change this
                this.pilout.pilout.subproofs[i].airs[j].symbols = this.pilout.pilout.symbols;
                this.pilout.pilout.subproofs[i].airs[j].hints = this.pilout.pilout.hints;
                this.pilout.pilout.subproofs[i].airs[j].numChallenges = this.pilout.pilout.numChallenges;
            }
        }

        const { proofCtx, subproofsCtx } = proofContextFromPilout(this.pilout);
        this.proofCtx = proofCtx;
        this.subproofsCtx = subproofsCtx;

        this.wcManager.proofCtx = proofCtx;
        this.wcManager.subproofsCtx = subproofsCtx;

        this.proversManager.proofCtx = proofCtx;
        this.proversManager.subproofsCtx = subproofsCtx;


        this.initialized = true;
        log.info(`[${this.name}]`, `< Initialized`);
        
        return;

        async function proofManagerConfigIsValid(proofManagerConfig) {
            const fields = ["pilout", "witnessCalculators", "prover"];
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

    async verifyPil() {
        this.checkInitialized();

        try {
            await this.proversManager.setup();

            await this.newProof();

            await this.wcManager.witnessComputationX(1);

            let result = true;
            for (const subproofCtx of this.subproofsCtx) {
                for (const airCtx of subproofCtx.airsCtx) {
                    for (const airInstanceCtx of airCtx.instances) {
                        const id = this.proversManager.getProverId(subproofCtx.subproofId, airCtx.airId, airCtx.numRows);
                        result = result && await this.proversManager.provers[id].pilVerify(subproofCtx, airCtx.airId, airInstanceCtx.instanceId);
                    }
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

    async newProof() {
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                airCtx.instances = [];
            }
        }
    }

    async generateProof() {
        this.checkInitialized();

        try {
            log.info(`[${this.name}]`, `--> Initiating the generation of the proof '${this.proofManagerConfig.name}'.`);

            await this.proversManager.setup();

            await this.newProof();

            let proverTaskStatus = PROVER_OPENING_TASKS_PENDING;
            for (let stageId = 1; proverTaskStatus !== PROVER_OPENING_TASKS_COMPLETED; stageId++) {
                let str = stageId <= this.pilout.numStages + 1 ? "STAGE" : "OPENINGS";
                log.info(`[${this.name}]`, `==> ${str} ${stageId}`);

                await this.wcManager.witnessComputationX(stageId);

                proverTaskStatus = await this.proversManager.computeStage(stageId);

                log.info(`[${this.name}]`, `<== ${str} ${stageId}`);
            }

            // TODO now proof is hardcoded as the proof in subproof[0].air[0]
            // TODO this has to change to generate a proof from all subproofs (airs)

            log.info(`[${this.name}]`, `<-- Proof '${this.proofManagerConfig.name}' successfully generated.`);

        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve();
        }

        // TODO remove
        return this.subproofsCtx[0].airsCtx[0].instances[0].proof;
    }

    finalizeProve() {
        // TODO Finalize pilout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }

    // Allocate a new buffer for the given subproofId and airId with the given numRows.
    addAirInstance(subproofCtx, airId, numRows) {
        const airCtx = subproofCtx.airsCtx[airId];

        if (airCtx === undefined) return { result: false, data: undefined };

        numRows = numRows ?? airCtx.numRows;
        const airInstanceCtx = subproofCtx.addAirInstance(airId, numRows);

        const air = this.pilout.getAirBySubproofIdAirId(subproofCtx.subproofId, airId);
        const airSymbols = this.pilout.pilout.symbols.filter(symbol => symbol.subproofId === subproofCtx.subproofId && symbol.airId === airId);

        airInstanceCtx.wtnsPols = newCommitPolsArrayPil2(airSymbols, air.numRows, subproofCtx.F);

        return { result: true, airInstanceCtx};
    }

    // Reallocate the buffer for the given subproofId and airId with the given numRows.
    resizeAirInstance(subproofCtx, airId, instanceId, numRows) {
        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[instanceId];

        if(airInstanceCtx === undefined) return { result: false, data: undefined };

        const factor = airInstanceCtx.numRows / numRows;

        //TODO change this to a more efficient way...resize??? it's not working, why?
        airInstanceCtx.buffer = airInstanceCtx.buffer.slice(0, airInstanceCtx.buffer.byteLength / factor);
        //buffer.buffer.resize(buffer.buffer.byteLength / factor);
        return { result: true, airInstanceCtx };
    }

    // Free the buffer for the given subproofId and airId.
    removeAirInstance(subproofCtx, airId, instanceId) {
        if(subproofCtx.airs[airId] === undefined) return false;

        const airInstanceCtx = subproofCtx.airsCtx[airId].instances[instanceId];
        if(airInstanceCtx === undefined) return false;

        subproofCtx.airsCtx[airId].instances.splice(instanceId, 1);

        return true;
    }

    
}