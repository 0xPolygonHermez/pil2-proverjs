/// WITNESS CALCULATORS
/// -----------------------------------------------------------------------------------------

// Witness calculators, also called modules, are components responsible for computing
// witnesses during a given stage. Typically, these modules attempt to perform their tasks independently,
// but they may occasionally need to wait for other modules to complete their work before proceeding.
// The execution of modules follows a round-robin approach, with each round representing the execution
// of a single module. This round-robin execution continues until either all modules have completed their
// tasks for the current stage or all modules that still have some pending tasks are temporarily locked,
// waiting for some task to be finished.
// These special modules, known as deferred modules, are executed only when all regular modules are locked.
// This approach is valuable in scenarios where, for example, a module intends to perform batch division
// and designates it as a deferred task. As a result, the deferred division module only executes when all
// regular modules are locked, allowing it to efficiently process multiple divisions in batch mode.

// Modules are executed in the order they were registered within the WitnessCalculatorManager.
// Similarly, deferred modules are executed in the order they were registered in the WitnessCalculatorManager.

const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const { AirBus, AirBusPayload, PayloadTypeEnum } = require("./proof_bus.js");

const { ModuleTypeEnum } = require("./witness_calculator_component.js");

const WC_MANAGER_NAME = "WC Manager";

const log = require('../logger.js');
const Mutex = require("./concurrency/mutex.js");
const AsyncAccLock = require("./concurrency/async_acc_lock.js");
const TargetLock = require("./concurrency/target_lock.js");

const path = require("path");

// WitnessCalculator class acting as the composite
module.exports = class WitnessCalculatorManager {
    constructor(proofCtx) {
        this.initialized = false;

        this.name = WC_MANAGER_NAME;
        this.proofCtx = proofCtx;

        this.wc = [];
        this.wcLocks = [];        
        this.wcDeferredLock;

        this.airBus = new AirBus();
        this.lastSolvedpayloadId;
        this.airBusMutex = new Mutex();

        // TODO remove when access to data is implemented
        this.data= [];

        this.options;
    }

    async initialize(witnessCalculatorsConfig, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Witness Calculator Manager already initialized.`);
        }

        try {
            this.options = options;

            log.info(`[${this.name}]`, "Initializing...");

            for(const config of witnessCalculatorsConfig) {
                const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(config.witnessCalculatorLib, this, this.proofCtx);
                newWitnessCalculator.initialize(config, options);
        
                this.wc.push(newWitnessCalculator);
            }
        } catch (err) {
            log.error(`[${this.name}]`, `Error initializing Witness Calculator Manager: ${err}`);
            throw new Error(`Error initializing Witness Calculator Manager: ${err}`);
        } finally {
            this.initialized = true;
        }
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    async witnessComputation(stageId, publics) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing witness stage ${stageId}.`);
        
        const regulars = this.wc.filter(wc => wc.type === ModuleTypeEnum.REGULAR);
        const executors = [];

        this.wcDeferredLock = new TargetLock(regulars.length, 0);

        // NOTE: The first witness calculator is always the witness calculator deferred
        executors.push(this.witnessComputationDeferred(stageId, this.subproofsCtx, -1, -1));

        if(stageId === 1) {
            for (const subproofCtx of this.subproofsCtx) {
                for (const wc of regulars) {
                    if(!wc.sm || subproofCtx.name === wc.sm) {
                        executors.push(wc._witnessComputation(stageId, subproofCtx, -1, -1, publics));
                    }
                }
            }   
        } else {
            for (const wc of regulars) {
                for(const instance of this.proofCtx.instances) {
                    const subproofCtx = this.subproofsCtx[instance.subproofId];
                        // TODO change this
                        instance.ctx.subproofValues.push(1n);
                        // TODO change this

                    if(!wc.sm || subproofCtx.name === wc.sm) {
                        executors.push(wc._witnessComputation(stageId, subproofCtx, instance.airId, instance.instanceId, publics));
                    }
                }
            }
        }        

        await Promise.all(executors);

        if(this.airBus.hasPendingPayloads()) {
            log.error(`[${this.name}]`, `Some witness calculators have pending payloads for stage ${stageId}. Unable to continue`);
            throw new Error(`Some witness calculators have pending payloads for stage ${stageId}. Unable to continue`);
        }

        log.info(`[${this.name}]`, `<-- Computing witness stage ${stageId}.`);
    }

    async addBusPayload(payload, lock = false) {
        const payloadTypesAllowed = [PayloadTypeEnum.NOTIFICATION];

        const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === payload.sender);
        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Bus Payload sender '${payload.sender}' not found`);
            throw new Error(`Bus Payload sender '${payload.sender}' not found`);
        }

        if(payload.recipient !== this.name) {
            const recipient = this.wc.find(witnesscalculator => witnesscalculator.name === payload.recipient);
            if(!recipient) {
                log.error(`[${this.name}]`, `Bus Payload recipient '${payload.recipient}' not found`);
                throw new Error(`Bus Payload recipient '${payload.recipient}' not found`);
            }
        }

        if(!payloadTypesAllowed.includes(payload.type)) {
            log.error(`[${this.name}]`, `Bus Payload type '${payload.type}' not allowed`);
            throw new Error(`Bus Payload type '${payload.type}' not allowed`);
        }

        this.airBus.addBusPayload(payload);

        if(lock) {
            if(!this.wcLocks[senderIdx]) this.wcLocks[senderIdx] = new AsyncAccLock();
            log.info(`[${this.name}]`, `Locking witness calculator ${this.wc[senderIdx].name}`);

            this.airBusMutex.unlock();
            if(this.wcDeferredLock) this.wcDeferredLock.release();
            await this.wcLocks[senderIdx].lock();
        }
    }

    resolveBusPayload(payloadId) {
        const payload = this.airBus.payloads.find(payload => payload.payloadId === payloadId);
        const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === payload.sender);

        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Bus Payload sender '${payload.sender}' not found`);
            throw new Error(`Bus Payload sender '${payload.sender}' not found`);
        }

        this.airBus.resolveBusPayload(payloadId);

        // TODO: Do we need a mutex covering this.lastSolvedpayloadId?
        this.lastSolvedpayloadId = payloadId;

        if(this.wcLocks[senderIdx]) {
            log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
            if(this.wcDeferredLock) this.wcDeferredLock.acquire();
            this.wcLocks[senderIdx].unlock();
        }
    }

    getBusPayloadsByRecipient(recipient) {
        return this.airBus.getPendingPayloadsByRecipient(recipient);
    }

    async readData(module, dataId) {
        this.airBusMutex.lock();

        //TODO read data from proofCtx
        if(!this.data[dataId]) {
            const payload = new AirBusPayload(module.name, this.name, PayloadTypeEnum.NOTIFICATION, "resolve", { dataId });
            await this.addBusPayload(payload, true);
        } else {
            this.airBusMutex.unlock();
        }

        return this.data[dataId];
    }

    async writeData(module, dataId, data) {
        this.airBusMutex.lock();

        this.data[dataId] = data;

        const payloads = this.airBus.getPendingPayloadsByTagDataId("resolve", dataId);
        
        for(const payload of payloads) {
            payload.isPending = false;
            
            const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === payload.sender);
            if(this.wcLocks[senderIdx]) {
                log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
                this.wcLocks[senderIdx].unlock();
            }
        }

        this.airBusMutex.unlock();
    }

    releaseDeferredLock() { 
        if(this.wcDeferredLock) this.wcDeferredLock.release();
    }

    async executeDeferredModules(stageId, airCtx, instanceId) {
        const deferredModules = this.wc.filter(wc => wc.type === ModuleTypeEnum.DEFERRED);

        for(const module of deferredModules) {
            await module._witnessComputation(stageId, airCtx, instanceId);
        }
    }

    async witnessComputationDeferred(stageId, subproofCtx, airId, instanceId, publics) {
        return new Promise(async (resolve, reject) => {
            let _lastSolvedpayloadId;
            try {
                while(true) {
                    await this.wcDeferredLock.lock();
    
                    if(!this.airBus.hasPendingPayloads()) break;

                    log.info(`[${this.name}]`, `Initiating the process to unblock witness calculators`);

                    await this.executeDeferredModules(stageId, airId, instanceId);
    
                    const lastSolvedpayloadId = this.lastSolvedpayloadId;
                    if(_lastSolvedpayloadId === lastSolvedpayloadId) {
                        log.error(`[${this.name}]`, "The executing processes do not respond, processes are stucked.")
                        throw new Error("The executing processes do not respond, processes are stucked.");
                    }   
                    
                    _lastSolvedpayloadId = lastSolvedpayloadId;
                }
    
                this.releaseDeferredLock();
                
                resolve();
            } catch (err) {
                log.error(`[${this.name}]`, `Witness computation failed.`, err);
                reject(err);
            }
        });
    }
}