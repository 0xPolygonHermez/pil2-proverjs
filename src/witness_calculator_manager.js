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
const PendingTaskTable = require("./task_table.js");

const { Task, TaskTypeEnum } = require("./task.js");

const { ModuleTypeEnum } = require("./witness_calculator_component.js");

const WC_MANAGER_NAME = "wcManager";

const log = require('../logger.js');
const Mutex = require("./concurrency/mutex.js");
const AsyncAccLock = require("./concurrency/async_acc_lock.js");
const TargetLock = require("./concurrency/target_lock.js");

const path = require("path");

// WitnessCalculator class acting as the composite
class WitnessCalculatorManager {
    constructor(proofmanagerAPI) {
        this.initialized = false;

        this.name = WC_MANAGER_NAME;
        this.proofmanagerAPI = proofmanagerAPI;

        this.wc = [];
        this.wcLocks = [];        
        this.wcDeferredLock;

        this.tasksTable = new PendingTaskTable();
        this.lastSolvedTaskId;
        this.tasksTableMutex = new Mutex();

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
                const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(config.witnessCalculatorLib, this, this.proofmanagerAPI);
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

        log.info(`[${this.name}]`, `==> Computing witness stage ${stageId}.`);
        
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
            for (const subproofCtx of this.subproofsCtx) {
                for (const airCtx of subproofCtx.airsCtx) {
                    for (const wc of regulars) {
                        if(!wc.sm || airCtx.name.startsWith(wc.sm)) {
                            if(airCtx.instances.length > 0) {
                                const instances = airCtx.instances.map(airInstanceCtx => airInstanceCtx.instanceId);
            
                                for (const instanceId of instances) {
                                    const airInstanceCtx = airCtx.instances[instanceId];
                                    // TODO change!!!!!!!
                                    // if(stageId===2 && instanceId !== -1) airInstanceCtx.ctx.publics = publics;
                                    if(airInstanceCtx.ctx.subproofValues) airInstanceCtx.ctx.subproofValues.push(1n);
                                    // TODO change this

                                    executors.push(wc._witnessComputation(stageId, subproofCtx, airCtx.airId, instanceId, publics));
                                }
                            }
                        }
                    }
                }
            }
        }        

        await Promise.all(executors);

        if(this.tasksTable.hasPendingTasks()) {
            log.error(`[${this.name}]`, `Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
            throw new Error(`Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
        }

        log.info(`[${this.name}]`, `<== Computing witness stage ${stageId}.`);
    }

    async addPendingTask(task, lock = false) {
        const taskTypesAllowed = [TaskTypeEnum.NOTIFICATION];

        const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === task.sender);
        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Task sender '${task.sender}' not found`);
            throw new Error(`Task sender '${task.sender}' not found`);
        }

        if(task.recipient !== this.name) {
            const recipient = this.wc.find(witnesscalculator => witnesscalculator.name === task.recipient);
            if(!recipient) {
                log.error(`[${this.name}]`, `Task recipient '${task.recipient}' not found`);
                throw new Error(`Task recipient '${task.recipient}' not found`);
            }
        }

        if(!taskTypesAllowed.includes(task.type)) {
            log.error(`[${this.name}]`, `Task type '${task.type}' not allowed`);
            throw new Error(`Task type '${task.type}' not allowed`);
        }

        this.tasksTable.addTask(task);

        if(lock) {
            if(!this.wcLocks[senderIdx]) this.wcLocks[senderIdx] = new AsyncAccLock();
            log.info(`[${this.name}]`, `Locking witness calculator ${this.wc[senderIdx].name}`);

            this.tasksTableMutex.unlock();
            if(this.wcDeferredLock) this.wcDeferredLock.release();
            await this.wcLocks[senderIdx].lock();
        }
    }

    resolvePendingTask(taskId) {
        const task = this.tasksTable.tasks.find(task => task.taskId === taskId);
        const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === task.sender);

        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Task sender '${task.sender}' not found`);
            throw new Error(`Task sender '${task.sender}' not found`);
        }

        this.tasksTable.resolveTask(taskId);

        // TODO: Do we need a mutex covering this.lastSolvedTaskId?
        this.lastSolvedTaskId = taskId;

        if(this.wcLocks[senderIdx]) {
            log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
            if(this.wcDeferredLock) this.wcDeferredLock.acquire();
            this.wcLocks[senderIdx].unlock();
        }
    }

    getPendingTasksByRecipient(recipient) {
        return this.tasksTable.getPendingTasksByRecipient(recipient);
    }

    async readData(module, dataId) {
        this.tasksTableMutex.lock();

        //TODO read data from proofmanagerAPI
        if(!this.data[dataId]) {
            const task = new Task(module.name, this.name, TaskTypeEnum.NOTIFICATION, "resolve", { dataId });
            await this.addPendingTask(task, true);
        } else {
            this.tasksTableMutex.unlock();
        }

        return this.data[dataId];
    }

    async writeData(module, dataId, data) {
        this.tasksTableMutex.lock();

        this.data[dataId] = data;

        const tasks = this.tasksTable.getPendingTasksByTagDataId("resolve", dataId);
        
        for(const task of tasks) {
            task.isPending = false;
            
            const senderIdx = this.wc.findIndex(witnesscalculator => witnesscalculator.name === task.sender);
            if(this.wcLocks[senderIdx]) {
                log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
                this.wcLocks[senderIdx].unlock();
            }
        }

        this.tasksTableMutex.unlock();
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
            let _lastSolvedTaskId;
            try {
                while(true) {
                    await this.wcDeferredLock.lock();
    
                    if(!this.tasksTable.hasPendingTasks()) break;

                    log.info(`[${this.name}]`, `Initiating the process to unblock witness calculators`);

                    await this.executeDeferredModules(stageId, airId, instanceId);
    
                    const lastSolvedTaskId = this.lastSolvedTaskId;
                    if(_lastSolvedTaskId === lastSolvedTaskId) {
                        log.error(`[${this.name}]`, "The executing processes do not respond, processes are stucked.")
                        throw new Error("The executing processes do not respond, processes are stucked.");
                    }   
                    
                    _lastSolvedTaskId = lastSolvedTaskId;
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

module.exports = {
    WitnessCalculatorManager,
    WC_MANAGER_NAME,
    TaskTypeEnum
};
