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
const { calculateExpression, calculateExpressionAtRow } = require("pil2-stark-js/src/prover/prover_helpers.js");

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

  calculateExp = function calculateExp(airInstance, expId) {
    const air = this.proofCtx.airout.getAirBySubproofIdAirId(airInstance.subproofId, airInstance.airId);

    const setup = this.proofCtx.setup.setup[airInstance.subproofId][airInstance.airId];

    const expressionsInfo = setup.expressionsInfo;
    const starkInfo = setup.starkInfo;

    let ctx;
    if(airInstance.ctx) {
        ctx = airInstance.ctx;
    } else {
          ctx = {
            N: air.numRows,
            nBits: Math.log2(air.numRows),
            pilInfo: starkInfo,
            expressionsInfo,
            const_n: setup.fixedPols.polBuffer,
            cm1_n: airInstance.wtnsPols.polBuffer,
            publics: this.proofCtx.publics,
         }
    }

    return calculateExpression(ctx, expId);
  }

  calculateExpAtRow = function calculateExpAtRow(airInstance, expId, row) {
    const air = this.proofCtx.airout.getAirBySubproofIdAirId(airInstance.subproofId, airInstance.airId);

    const setup = this.proofCtx.setup.setup[airInstance.subproofId][airInstance.airId];

    const expressionsInfo = setup.expressionsInfo;
    const starkInfo = setup.starkInfo;

    let ctx;
    if(airInstance.ctx) {
        ctx = airInstance.ctx;
    } else {
          ctx = {
            N: air.numRows,
            nBits: Math.log2(air.numRows),
            pilInfo: starkInfo,
            expressionsInfo,
            const_n: setup.fixedPols.polBuffer,
            cm1_n: airInstance.wtnsPols.polBuffer,
            publics: this.proofCtx.publics,
         }
    }


    return calculateExpressionAtRow(ctx, expId, row);
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
