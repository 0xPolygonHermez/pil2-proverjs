// WITNESS CALCULATOR BASE CLASS
// ================================================================================================
/// This module defines the WitnessCalculatorComponent class, which is the base class for all
/// witness calculators. The witnessComputation() method is the method that should be implemented
/// by all witness calculators. It will be called once or several times by the witness calculator
/// manager during the witness computation process for each stage.
/// Every time the witnessComputation() method is called, it will be passed the following arguments:
///     - stageId: the ID of the current stage
///     - subproofId: the ID of the current subproof
///     - airId: the ID of the AIR
///     - instanceId: the ID of the instance
///     - proofCtx: the proof context object
///     - subproofCtx: the subproof context object
/// The `witnessComputation()` method should return one of the following values:

const Task = require("./task.js");
const { WC_MANAGER_NAME, TaskTypeEnum } = require("./witness_calculator_manager.js");
const log = require("../logger.js");

// Abstract base class for all WitnessCalculator components
class WitnessCalculatorComponent {
    constructor(name, proofmanagerAPI) {
        this.name = name;
        this.proofmanagerAPI = proofmanagerAPI;

        this.initialized = false;
        this.settings = null;
        this.options = null;
    }

    initialize(settings, options) {
        log.info(`[${this.name}]`, "Initializing...");

        this.settings = settings;
        this.options = options;
        this.initialized = true;
    }

    checkInitialized() {
        if (!this.initialized) {
            log.info(`[${this.name}]`, "Not initialized.");
            throw new Error(`[${this.name}] Not initialized.`);
        }
    }

    async witnessComputation() {
        throw new Error("Method 'witnessComputation' must be implemented in concrete classes.");
    }

    async _witnessComputation(stageId, airCtx, instanceId) {
        return new Promise(async (resolve, reject) => {
            try {
                log.info(`[${this.name}]`, `··> stageId: ${stageId}, airCtx: ${airCtx.airId}, instanceId: ${instanceId}`);

                await this.witnessComputation(stageId, airCtx, instanceId);

                this.wcManager.releaseDeferredLock();
                
                resolve();

                log.info(`[${this.name}]`, `<·· stageId: ${stageId}`);
            } catch (err) {
                log.error(`[${this.name}]`, `Witness computation failed.`, err);
                reject(err);
            }
        });
    }

    setWcManager(wcManager) {
        this.wcManager = wcManager;
    }

    async _addPendingtask(lib, tag, data, lock) {
        const task = new Task(this.name, lib, TaskTypeEnum.NOTIFICATION, tag, data);
        return await this.wcManager.addPendingTask(task, lock);
    }

    addPendingTask(tag, data, log = false) {
        this._addPendingtask(WC_MANAGER_NAME, tag, data, log);
    }

    async addLibPendingTask(lib, tag, data, lock = false) {
        return await this._addPendingtask(lib, tag, data, lock);
    }

    resolvePendingTask(taskId) {
        return this.wcManager.resolvePendingTask(taskId);
    }

    getPendingTasksByRecipient(recipient) {
        return this.wcManager.getPendingTasksByRecipient(recipient);
    }
}

module.exports = {
    WitnessCalculatorComponent
};
