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
///     - WITNESS_ROUND_NOTHING_TO_DO: The witness calculator has no task for the current stage.
///     - WITNESS_ROUND_FULLY_DONE: The calculator has completed all its tasks for the current stage.
///     - WITNESS_ROUND_NOTHING_DONE: The calculator has pending tasks but hasn't started because it's
///         waiting for another component to act first.
///     - WITNESS_ROUND_PARTIAL_DONE: The calculator has started but waits for another component to finish
///         its part before continuing its tasks.

const { Task, NOTIFICATION_TYPE } = require("./task.js");
const { WC_MANAGER_NAME, WITNESS_ROUND_NOTHING_DONE } = require("./witness_calculator_manager.js");
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

    initialState() {
        return WITNESS_ROUND_NOTHING_DONE;
    }

    async witnessComputation(
        stageId,
        subproofId,
        airId,
        instanceId,
        proofCtx,
        subproofCtx
    ) {
        return WITNESS_ROUND_NOTHING_TO_DO;
    }

    setWcManager(wcManager) {
        this.wcManager = wcManager;
    }

    async _addPendingtask(lib, tag, data, lock) {
        const task = new Task(this.name, lib, NOTIFICATION_TYPE, tag, data);
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
