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

/// MODULE STATES
/// -----------------------------------------------------------------------------------------

// - State: NOTHING_TO_DO
//   Represents a state with any task for current stage.

// - State: TASKS_DONE
//   Represents a state where all tasks have been completed in the current stage.

// - State: PENDING_TASKS
//   Represents a state with pending tasks to be completed during the current stage.

// Initial State: PENDING_TASKS

// Transitions:
// - Transition: PENDING_TASKS -> PENDING_TASKS
//   Description: Remains in the PENDING_TASK state when there are still pending tasks to complete.

// - Transition: PENDING_TASKS -> NOTHING_TO_DO
//   Description: Transitions to the NOTHING_TO_DO state when there are no more pending tasks.

// - Transition: PENDING_TASKS -> TASKS_DONE
//   Description: Transitions to the TASKS_DONE state when all pending tasks are completed.


/// DEFERRED MODULE STATES 
/// -----------------------------------------------------------------------------------------

// - State: WAIT_UNTIL_LOCKED
//   Represents a state where the machine is waiting until the remainig witness calculator
//   components 

// - Transition: WAIT_UNTIL_LOCKED -> WAIT_UNTIL_LOCKED
//   Description: Remains in the WAIT_UNTIL_LOCKED state while waiting for a lock condition.

const WITNESS_ROUND_NOTHING_TO_DO = 1;
const WITNESS_ROUND_NOTHING_DONE = 2;
const WITNESS_ROUND_PARTIAL_DONE = 3;
const WITNESS_ROUND_FULLY_DONE = 4;
const WAIT_UNTIL_LOCKED = 5;

const WitnessCalculatorFactory = require("./witness_calculator_factory.js");
const PendingTaskTable = require("./task_table.js");

const WC_MANAGER_NAME = "WCManager";

const log = require('../logger.js');
const Mutex = require("./concurrency/mutex.js");

// WitnessCalculator class acting as the composite
class WitnessCalculatorManager {
    constructor(proofmanagerAPI) {
        this.name = WC_MANAGER_NAME;
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.witnesscalculators = [];

        this.locks = [];

        this.pendingTaskTable = new PendingTaskTable();
    }

    async initialize(witnessCalculatorsConfig, options) {
        if (this.initialized) {
            log.error(`[${this.name}]`, "Already initialized.");
            throw new Error(`[${this.name}] Witness Calculator Manager already initialized.`);
        }

        log.info(`[${this.name}]`, "Initializing...");

        this.initialized = true;

        for(const witnessCalculator of witnessCalculatorsConfig) {
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(witnessCalculator.witnessCalculatorLib, this.proofmanagerAPI);
            newWitnessCalculator.initialize(witnessCalculator.settings, options);

            this.registerWitnessCalculator(newWitnessCalculator);
        }
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    registerWitnessCalculator(witnesscalculator) {
        this.checkInitialized();

        witnesscalculator.setWcManager(this);
        this.witnesscalculators.push(witnesscalculator);
    }

    async witnessComputation(stageId) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing witness for stage ${stageId}.`);
        
        /////////////////////////////////////
        let wcStatusTable = [];
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                if(airCtx.instances.length === 0) {
                    for(let i =0; i < this.witnesscalculators.length; i++) {
                        wcStatusTable.push({ wcId: i, airCtx, airInstanceId: -1, status: this.witnesscalculators[i].initialState()});
                    }
                } else {
                    for(let i =0; i < this.witnesscalculators.length; i++) {
                        for (const airInstanceCtx of airCtx.instances) {
                        wcStatusTable.push({ wcId: i, airCtx, airInstanceId: airInstanceCtx.instanceId, status: this.witnesscalculators[i].initialState()});
                    }
                }
                }
            }
        }
        /////////////////////////////////////

        const numWitnessCalculators = wcStatusTable.length;

        let nPendingToFinish = numWitnessCalculators;
        let x = nPendingToFinish;
        let lastId = -1;

        for(let i = 0; x > 0; i = (i+1) % numWitnessCalculators) {
            const wcStatus = wcStatusTable[i].status;

            if (wcStatus === WITNESS_ROUND_FULLY_DONE || 
                wcStatus === WITNESS_ROUND_NOTHING_TO_DO ||
                wcStatus === WAIT_UNTIL_LOCKED) continue;

            if(lastId !== -1 && lastId === i) {
                log.error(`[${this.name}]`, `WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
                throw new Error(`WitnessCalculator ${this.witnesscalculators[i].name} is stuck in witness computation for stage ${stageId}`);
            }

            const status = await this.witnesscalculators[wcStatusTable[i].wcId].witnessComputation(stageId, wcStatusTable[i].airCtx, wcStatusTable[i].airInstanceId);

            if(![WITNESS_ROUND_NOTHING_TO_DO, WITNESS_ROUND_NOTHING_DONE, WITNESS_ROUND_PARTIAL_DONE,WITNESS_ROUND_FULLY_DONE, WAIT_UNTIL_LOCKED].includes(status)) {
                log.error(`[${this.name}]`, `Unknown witnesscalculator status return value: ${wcStatus}`);
                throw new Error(`Unknown witnesscalculator status return value: ${wcStatus}`);
            }

            wcStatusTable[i].status = status;

            if(status === WITNESS_ROUND_FULLY_DONE || status === WITNESS_ROUND_PARTIAL_DONE) {
                lastId = i;
            }

            if (status === WITNESS_ROUND_NOTHING_DONE) {
                x--;
            } else if (status === WITNESS_ROUND_FULLY_DONE || status === WITNESS_ROUND_NOTHING_TO_DO) {
                x = --nPendingToFinish;
            }

            // Here we have to check if all not finished modules are stucked
            // If so, we have to execute deferred modules, so all that have a WAIT_UNTIL_LOCKED status
            // If there are no deferred modules, we have to end the iteration and outside the for we have to check if there are still modules with pending tasks
            // If there are no pending tasks, we can end the witness computation
            // If there are still pending tasks, we have to throw an error
        }

        if(this.pendingTaskTable.hasPendingTasks()) {
            log.error(`[${this.name}]`, `Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
            throw new Error(`Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
        }

        if(nPendingToFinish !== 0) {
            wcStatusTable.forEach((status, index) => {
                if(status.status !== WITNESS_ROUND_FULLY_DONE)
                    log.error(`[${this.name}]`, `WitnessCalculator ${this.witnesscalculators[index].name} did not finish witness computation for stage ${stageId}`);
            });
            log.error(`[${this.name}]`, `Unable to compute all witnesses for stage ${stageId}`);
            throw new Error(`Unable to compute all witnesses for stage ${stageId}`);
        }

        log.info(`[${this.name}]`, `<-- Computing witness for stage ${stageId}.`);
    }

    async witnessComputationX(stageId) {
        this.checkInitialized();

        log.info(`[${this.name}]`, `--> Computing witness for stage ${stageId}.`);
        
        /////////////////////////////////////
        let wcStatusTable = [];
        for (const subproofCtx of this.subproofsCtx) {
            for (const airCtx of subproofCtx.airsCtx) {
                if(airCtx.instances.length === 0) {
                    for(let i =0; i < this.witnesscalculators.length; i++) {
                        wcStatusTable.push({ wcId: i, airCtx, airInstanceId: -1, status: this.witnesscalculators[i].initialState()});
                    }
                } else {
                    for(let i =0; i < this.witnesscalculators.length; i++) {
                        for (const airInstanceCtx of airCtx.instances) {
                        wcStatusTable.push({ wcId: i, airCtx, airInstanceId: airInstanceCtx.instanceId, status: this.witnesscalculators[i].initialState()});
                    }
                }
                }
            }
        }

        /////////////////////////////////////

        const executors = this.witnesscalculators.map((wc, index) =>
            wc.witnessComputation(stageId, wcStatusTable[index].airCtx, wcStatusTable[index].airInstanceId));

        await Promise.all(executors);

        if(this.pendingTaskTable.hasPendingTasks()) {
            log.error(`[${this.name}]`, `Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
            throw new Error(`Some witness calculators have pending tasks for stage ${stageId}. Unable to continue`);
        }

        log.info(`[${this.name}]`, `<-- Computing witness for stage ${stageId}.`);
    }

    async addPendingTask(task, lock = false) {
        const taskTypesAllowed = ["notification"];

        const senderIdx = this.witnesscalculators.findIndex(witnesscalculator => witnesscalculator.name === task.sender);
        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Task sender '${task.sender}' not found`);
            throw new Error(`Task sender '${task.sender}' not found`);
        }

        if(task.recipient !== this.name) {
            const recipient = this.witnesscalculators.find(witnesscalculator => witnesscalculator.name === task.recipient);
            if(!recipient) {
                log.error(`[${this.name}]`, `Task recipient '${task.recipient}' not found`);
                throw new Error(`Task recipient '${task.recipient}' not found`);
            }
        }

        if(!taskTypesAllowed.includes(task.type)) {
            log.error(`[${this.name}]`, `Task type '${task.type}' not allowed`);
            throw new Error(`Task type '${task.type}' not allowed`);
        }

        this.pendingTaskTable.addTask(task);

        if(lock) {
            if(!this.locks[senderIdx]) this.locks[senderIdx] = new Mutex(true);

            await this.locks[senderIdx].lock();
        }
    }

    resolvePendingTask(taskId) {
        const task = this.pendingTaskTable.tasks.find(task => task.taskId === taskId);
        const senderIdx = this.witnesscalculators.findIndex(witnesscalculator => witnesscalculator.name === task.sender);

        if(senderIdx === -1) {
            log.error(`[${this.name}]`, `Task sender '${task.sender}' not found`);
            throw new Error(`Task sender '${task.sender}' not found`);
        }

        this.pendingTaskTable.resolveTask(taskId);

        if(this.locks[senderIdx] && this.locks[senderIdx].isLocked) {
            this.locks[senderIdx].unlock();
        }
    }

    getPendingTasksByRecipient(recipient) {
        return this.pendingTaskTable.getPendingTasksByRecipient(recipient);
    }
}

module.exports = {
    WitnessCalculatorManager,
    WC_MANAGER_NAME,
    WITNESS_ROUND_NOTHING_TO_DO,
    WITNESS_ROUND_NOTHING_DONE,
    WITNESS_ROUND_PARTIAL_DONE,
    WITNESS_ROUND_FULLY_DONE
};
