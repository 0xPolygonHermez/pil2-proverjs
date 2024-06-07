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
/// The `witnessComputation()` method should return one of the following values:

const { AirBusPayload, PayloadTypeEnum } = require("./proof_bus.js");
const log = require("../logger.js");

const ModuleTypeEnum = {
  REGULAR: 1,
  DEFERRED: 2,
};

// Abstract base class for all WitnessCalculator components
class WitnessCalculatorComponent {
  constructor(name, wcManager, proofCtx, type = ModuleTypeEnum.REGULAR) {
    this.name = name;
    this.wcManager = wcManager;
    this.proofCtx = proofCtx;
    this.type = type;

    this.initialized = false;
    this.settings = null;
    this.options = null;

    log.info(`[${this.name}]`, "Created.");
  }

  initialize(config, options) {
    log.info(`[${this.name}]`, "Initializing...");

    this.settings = config.settings;
    this.sm = config.sm;
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

  async _witnessComputation(stageId, subproofId, airId, instanceId, publics) {
    return new Promise(async (resolve, reject) => {
      try {
        // log.info(`[${this.name}]`, `-> stageId: ${stageId} airId: ${airId} instanceId: ${instanceId}`);

        await this.witnessComputation(stageId, subproofId, airId, instanceId, publics);

        this.wcManager.sendBroadcastData(this, {
          sender: this.name,
          type: "notification",
          payload: { data: "finished", stageId, subproofId, airId, instanceId },
        });
        this.wcManager.releaseDeferredLock();

        resolve();

        // log.info(`[${this.name}]`, `<- stageId: ${stageId} airId: ${airId} instanceId: ${instanceId}`);
      } catch (err) {
        log.error(`[${this.name}]`, `Witness computation failed.`, err);
        reject(err);
      }
    });
  }
}

module.exports = {
  WitnessCalculatorComponent,
  ModuleTypeEnum,
};
