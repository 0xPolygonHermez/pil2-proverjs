const WitnessCalculatorManager = require("./witness_calculator_manager.js");
const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const ProverFactory = require("./prover_factory.js");
const CheckerFactory = require("./checker_factory.js");
const ProofManagerAPI = require("./proof_manager_api.js");
const { PilOut } = require("./pilout.js");
const proofContextFromPilout = require("./proof_ctx.js");
const { newCommitPolsArrayPil2, newConstantPolsArrayPil2 } = require("pilcom/src/polsarray.js");

const pil2circom = require("pil2-stark-js/src/pil2circom");
const { proof2zkin } = require("pil2-stark-js/src/proof2zkin.js");
const wasm_tester = require("circom_tester/wasm/tester");
const fs = require("fs");


const { fileExists } = require("./utils.js");
const path = require("path");

const log = require("../logger.js");

class ProofManager {
    constructor(name) {
        this.initialized = false;

        this.name = name ?? "ProofManager";
    }

    async initialize(proofManagerConfig, options) {
        if (this.initialized) {
            log.error("`[${this.name}]`", "Already initialized.");
            throw new Error("ProofManager already initialized.");
        }

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
            newWitnessCalculator.initialize(witnessCalculator.settings, this.options);

            this.wcManager.registerWitnessCalculator(newWitnessCalculator);
        }

        this.prover = await ProverFactory.createProver(proofManagerConfig.prover.filename, proofmanagerAPI);
        this.prover.initialize(proofManagerConfig.prover.settings, this.options);

        this.checker = await CheckerFactory.createChecker(proofManagerConfig.checker.filename, proofmanagerAPI);
        this.checker.initialize(proofManagerConfig.checker.settings, this.options);        

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

    async verifyPil() {
        this.checkInitialized();

        try {
            await this.initializeProve();

            // [Executor] Compute trace columns values
            log.info(`[${this.name}]`, `==> STAGE 0`);
            await this.computeWitnessStage(0);
            log.info(`[${this.name}]`, `<== STAGE 0`);

            let result = true;
            for (const subproofCtx of this.subproofsCtx) {
                for (const airCtx of subproofCtx.airsCtx) {
                    for (const airInstanceCtx of airCtx.instances) {
                        result = result && await this.prover.pilVerify(subproofCtx, airCtx.airId, airInstanceCtx.instanceId);
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

    async prove() {
        this.checkInitialized();

        let proof;

        try {
            await this.initializeProve();

            proof = await this.generateProof();

            // TODO This code must be moved outside the proof manager when aggregated proof is implemented,
            // meanwhile it is here to check the proof generated by the proof manager in a simple way
            if(this.options.verify) {
                const airInstance = this.subproofsCtx[0].airsCtx[0].instances[0];

                const isValid = await this.checker.checkProof(airInstance.proof, 0, 0, this.proofCtx, this.subproofsCtx[0]);

                if(isValid == false) {
                    log.error(`[${this.name}]`, `Proof for subproof ${this.subproofsCtx[0].name} is invalid`);
                    throw new Error(`[${this.name}]`, `Proof for subproof ${this.subproofsCtx[0].name} is invalid`);
                } else {
                    log.info(`[${this.name}]`, `Proof for subproof ${this.subproofsCtx[0].name} is valid`);
                }

                // TODO remove this when all developed now is useful to check the proof in circom
                const tmpPath =  path.join(__dirname, "..", "tmp");
                if(!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath);
                const verifierFilename = path.join(tmpPath, "basic_stark_verifier_" + this.proofManagerConfig.name + ".circom");

                const verifierCircomTemplate = await pil2circom(airInstance.setup.constRoot, airInstance.setup.starkInfo, { hashCommits: true });
                await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");
        
                try {
                    const circuit = await wasm_tester(verifierFilename, { O:1, prime: "goldilocks", include: "node_modules/pil2-stark-js/circuits.gl", verbose: true });
            
                    const input = proof2zkin(airInstance.proof.proof, airInstance.setup.starkInfo);
                    input.publics = airInstance.proof.publics;
            
                    const witness = await circuit.calculateWitness(input, true);

                    // TODO change this to check all outputs
                    // await circuit.assertOut(witness, {out: 343n});
                } catch (error) {
                    log.error(`[${this.name}]`, `Error while verifying proof: ${error}`);
                    throw error;
                } finally {
                    await fs.promises.unlink(verifierFilename);
                }
            }
        } catch (error) {
            log.error(`[${this.name}]`, `Error while generating proof: ${error}`);
            throw error;
        } finally {
            this.finalizeProve();
        }

        return proof;
    }

    async initializeProve() {
        this.pilout = new PilOut(this.proofManagerConfig.pilout.piloutFilename, this.proofManagerConfig.pilout.piloutProto, this.options);

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
    }

    async generateProof() {
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

            if (stageId > 1) {
                this.setChallenges(stageId, this.proofCtx.getChallenge(stageId - 1));
            }

            await this.computeWitnessStage(stageId);

            await this.commitStage(stageId);

            await this.computeAirChallenges(stageId);
            
            this.computeProofChallenge(stageId);

            log.info(`[${this.name}]`, `<== STAGE ${stageId} finished`);
        }

        // [Prover] Call essential functions post-witness computation to produce a proof
        let proverCallbacks = [];
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    proverCallbacks.push(this.prover.getProverCallbacks(airInstanceCtx));
                }
            }
        }

        // TODO: check callbacks, if there is any item of array type, then ask to the prover to sort these callbacks for each airInstance 

        //TODO remove following line
        proverCallbacks = proverCallbacks[0];
        for (let i = 0; i < proverCallbacks.length; i++) {
            await this.callProverCallback(stageId + i, proverCallbacks[i]);

            if (i < proverCallbacks.length - 1) this.computeProofChallenge(stageId + i);
        }

        // TODO now proof is hardcoded as the proof in subproof[0].air[0]
        // TODO this has to chenge to generate a proof from all subproofs (airs)

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
                    await this.wcManager.witnessComputationStage0(subproofCtx.subproofId, airCtx.airId, subproofCtx);
                    //I'm GENERATING two instances for developing purposes !!!!!
                    await this.wcManager.witnessComputationStage0(subproofCtx.subproofId, airCtx.airId, subproofCtx);
                } else {
                    for (const airInstanceCtx of airCtx.instances) {
                        log.info(`[ProofManager]`, `··· Air '${airCtx.name}' Computing witness for stage ${stageId}.`);
                        await this.wcManager.witnessComputation(stageId, airInstanceCtx);
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

    computeProofChallenge(stageId) {
        //TODO !!!
        const challenge = this.subproofsCtx[0].airsCtx[0].instances[0].ctx.challenges[stageId];
        this.proofCtx.setChallenge(stageId, challenge);

        // for (const subproofCtx of this.subproofsCtx) {
        //     for (const airCtx of subproofCtx.airsCtx) {
        //         for (const airInstanceCtx of airCtx.instances) {
        //             log.info(`[ProofManager]`, `··· Air '${airCtx.name}' Computing proof challenge for stage ${stageId}.`);
        //             this.proofCtx.setChallenge(stageId, this.prover.computeProofChallenge(stageId, airInstanceCtx));
        //         }
        //     }
        // }
    }


    async callProverCallback(stageId, proverCallback) {
        const callback = proverCallback.callback;
        const params = proverCallback.params;

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    await callback(stageId, airInstanceCtx, params);
                }
            }
        }
    }

    finalizeProve() {
        // TODO Finalize pilout
        if (this.wcManager) delete this.wcManager;
        // TODO Finalize prover
        // TODO Finalize setup
    }

    async computeAirChallenges(stageId) {
        log.info(`[${this.name}]`, `··· Computing challenges for stage ${stageId}`);

        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const airInstanceCtx of airCtx.instances) {
                    return await this.prover.computeAirChallenges(stageId, airInstanceCtx);
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
