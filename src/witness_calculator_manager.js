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
const Task = require("./task.js");
const PendingTaskTable = require("./task_table.js");

const TaskTypeEnum = {
    NOTIFICATION: "notification",
};

const ModuleTypeEnum = {
    REGULAR: 1,
    DEFERRED: 2,
    DEFERRED_MANAGER: 3,
}

const WC_MANAGER_NAME = "WCManager";

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

            const regulars = witnessCalculatorsConfig.filter(wc => !(wc.settings.type) || wc.settings.type === "regular");
            const deferreds = witnessCalculatorsConfig.filter(wc => wc.settings.type === "deferred");

            regulars.forEach(wc => wc.settings.type = ModuleTypeEnum.REGULAR);
            deferreds.forEach(wc => wc.settings.type = ModuleTypeEnum.DEFERRED);

            if(deferreds.length > 0) {
                const deferredMgrLib =  path.join(__dirname, "witness_calculator_module.js");
                witnessCalculatorsConfig.unshift({ witnessCalculatorLib: deferredMgrLib, settings: { type: ModuleTypeEnum.DEFERRED_MANAGER} });
            }

            for(const config of witnessCalculatorsConfig) {
                const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(config.witnessCalculatorLib, this.proofmanagerAPI);
                newWitnessCalculator.initialize(config.settings, options);
        
                newWitnessCalculator.setWcManager(this);
        
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

    async witnessComputation(stageId) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing witness for stage ${stageId}.`);
        
        const regulars = this.wc.filter(wc => wc.settings.type === ModuleTypeEnum.REGULAR);
        const deferredMgr = this.wc.find(wc => wc.settings.type === ModuleTypeEnum.DEFERRED_MANAGER);
        const executors = [];

        if(deferredMgr) {
            this.wcDeferredLock = new TargetLock(regulars.length, 0);

            // NOTE: The first witness calculator is always the witness_calculator_module
            executors.push(deferredMgr._witnessComputation(stageId, this.subproofsCtx, -1));
        }
        
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                for (const wc of regulars) {
                    const instances = airCtx.instances.length === 0
                        ? [-1]
                        : airCtx.instances.map(airInstanceCtx => airInstanceCtx.instanceId);
    
                    for (const instanceId of instances) {
                        executors.push(wc._witnessComputation(stageId, airCtx, instanceId));
                    }
                }
            }
        }

        await Promise.all(executors);

        if(this.tasksTable.hasPendingTasks()) {
            log.error(`[${this.name}]`, `Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
            throw new Error(`Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
        }

        log.info(`[${this.name}]`, `<-- Computing witness for stage ${stageId}.`);
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

        task.lock = lock;
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

    async lockDeferred() {
        await this.wcDeferredLock.lock();
    }

    hasPendingTasks() {
        return this.tasksTable.hasPendingTasks();
    }

    releaseDeferredLock() { 
        if(this.wcDeferredLock) this.wcDeferredLock.release();
    }

    async executeDeferredModules(stageId, airCtx, airInstanceId) {
        const deferredModules = this.wc.filter(wc => wc.settings.type === ModuleTypeEnum.DEFERRED);

        for(const module of deferredModules) {
            if(module.settings.type !== ModuleTypeEnum.DEFERRED) continue;
            await module._witnessComputation(stageId, airCtx, airInstanceId);
        }
    }
}

module.exports = {
    WitnessCalculatorManager,
    WC_MANAGER_NAME,
    TaskTypeEnum
};
