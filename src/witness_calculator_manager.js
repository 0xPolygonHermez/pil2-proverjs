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

const log = require("../logger.js");
const Mutex = require("./concurrency/mutex.js");
const AsyncAccLock = require("./concurrency/async_acc_lock.js");
const TargetLock = require("./concurrency/target_lock.js");
const { AirInstance } = require("./proof_ctx.js");

// WitnessCalculator class acting as the composite
module.exports = class WitnessCalculatorManager {
  constructor() {
    this.initialized = false;

    this.name = WC_MANAGER_NAME;

    this.wc = [];
    this.wcLocks = [];
    this.wcDeferredLock;

    this.airBus = new AirBus();
    this.lastSolvedpayloadId;
    this.airBusMutex = new Mutex();

    // TODO remove when access to data is implemented
    this.data = [];

    this.inbox = [];
    this.mutex_inbox = new Mutex();

    this.options;
  }

  async initialize(config, proofCtx, options) {
    if (this.initialized) {
      log.error(`[${this.name}]`, "Already initialized.");
      throw new Error(`[${this.name}] Witness Calculator Manager already initialized.`);
    }

    try {
      this.proofCtx = proofCtx;
      this.options = options;

      log.info(`[${this.name}]`, "Initializing...");

      for (const setting of config) {
        const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(
          setting.witnessCalculatorLib,
          this,
          this.proofCtx
        );
        newWitnessCalculator.initialize(setting, options);

        this.wc.push(newWitnessCalculator);
      }
    } catch (err) {
      log.error(`[${this.name}]`, `Error initializing Witness Calculator Manager: ${err}`);
      throw new Error(`Error initializing Witness Calculator Manager: ${err}`);
    } finally {
      this.initialized = true;
    }
  }

  addInbox(name) {
    this.inbox.push({
      name,
      messages: [],
      mutex: new AsyncAccLock(),
    })

    return this.inbox.length - 1;
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

    const regulars = this.wc.filter((wc) => wc.type === ModuleTypeEnum.REGULAR);
    const executors = [];

    this.wcDeferredLock = new TargetLock(regulars.length, 0);

    // NOTE: The first witness calculator is always the witness calculator deferred
    // executors.push(this.witnessComputationDeferred(stageId));

    if (stageId === 1) {
      for (const subproof of this.proofCtx.airout.subproofs) {
        for (const wc of regulars) {
          if (!wc.sm || subproof.name === wc.sm) {
            let airInstance = new AirInstance(subproof.subproofId, -1, -1);
            executors.push(wc._witnessComputation(stageId, subproof.subproofId, airInstance, publics));
          }
        }
      }
    } else {
      for (const wc of regulars) {
        for (const airInstance of this.proofCtx.getAirInstances()) {
          const subproof = this.proofCtx.airout.subproofs[airInstance.subproofId];

          if (!wc.sm || subproof.name === wc.sm) {
            executors.push(
              wc._witnessComputation(
                stageId,
                airInstance.subproofId,
                airInstance,
                publics
              )
            );
          }
        }
      }
    }

    //Executor deferred exits before it has to do it...
    await Promise.all(executors);

    if (this.airBus.hasPendingPayloads()) {
      log.error(
        `[${this.name}]`,
        `Some witness calculators have pending payloads for stage ${stageId}. Unable to continue`
      );
      throw new Error(
        `Some witness calculators have pending payloads for stage ${stageId}. Unable to continue`
      );
    }

    for(let i = 0; i < this.inbox.length; ++i) {
      this.inbox[i].messages = [];
    }
    log.info(`[${this.name}]`, `<-- Computing witness stage ${stageId}.`);
  }

  async addNotification(sender, recipient, tag, data, lock = false) {
    const senderIdx = this.wc.findIndex((witnesscalculator) => witnesscalculator.name === sender);
    if (senderIdx === -1) {
      log.error(`[${this.name}]`, `Bus Payload sender '${sender}' not found`);
      throw new Error(`Bus Payload sender '${sender}' not found`);
    }

    if (recipient !== this.name) {
      const recipientIdx = this.wc.findIndex(
        (witnesscalculator) => witnesscalculator.name === recipient
      );
      if (recipientIdx === -1) {
        log.error(`[${this.name}]`, `Bus Payload recipient '${recipient}' not found`);
        throw new Error(`Bus Payload recipient '${recipient}' not found`);
      }
    }

    const payload = new AirBusPayload(sender, recipient, PayloadTypeEnum.NOTIFICATION, tag, data);

    this.airBus.addBusPayload(payload);

    if (lock) {
      if (!this.wcLocks[senderIdx]) this.wcLocks[senderIdx] = new AsyncAccLock();
      log.info(`[${this.name}]`, `Locking witness calculator ${this.wc[senderIdx].name}`);

      this.airBusMutex.unlock();
      this.wcDeferredLock.release();
      await this.wcLocks[senderIdx].lock();
    }
  }

  resolveBusPayload(payloadId) {
    const payload = this.airBus.getPayloadById(payloadId);

    if (!payload) {
      log.error(`[${this.name}]`, `Bus Payload ${payloadId} not found`);
      throw new Error(`Bus Payload ${payloadId} not found`);
    }

    const senderIdx = this.wc.findIndex(
      (witnesscalculator) => witnesscalculator.name === payload.sender
    );

    if (senderIdx === -1) {
      log.error(`[${this.name}]`, `Bus Payload sender '${payload.sender}' not found`);
      throw new Error(`Bus Payload sender '${payload.sender}' not found`);
    }

    this.airBus.resolveBusPayload(payloadId);

    // TODO: Do we need a mutex covering this.lastSolvedpayloadId?
    this.lastSolvedpayloadId = payloadId;

    if (this.wcLocks[senderIdx]) {
      log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
      if (this.wcDeferredLock) this.wcDeferredLock.acquire();
      this.wcLocks[senderIdx].unlock();
    }
  }

  async readData(module, dataId) {
    this.airBusMutex.lock();

    //TODO read data from proofCtx
    if (!this.data[dataId]) {
      await this.addNotification(module.name, this.name, "resolve", { dataId }, true);
    } else {
      this.airBusMutex.unlock();
    }

    return this.data[dataId];
  }

  async writeData(module, dataId, data) {
    this.airBusMutex.lock();

    this.data[dataId] = data;

    const payloads = this.airBus.getPendingPayloadsByTagDataId("resolve", dataId);

    for (const payload of payloads) {
      payload.isPending = false;

      const senderIdx = this.wc.findIndex(
        (witnesscalculator) => witnesscalculator.name === payload.sender
      );
      if (this.wcLocks[senderIdx]) {
        log.info(`[${this.name}]`, `Unlocking witness calculator ${this.wc[senderIdx].name}`);
        this.wcLocks[senderIdx].unlock();
      }
    }

    this.airBusMutex.unlock();
  }

  async sendBroadcastData(sender, data) {
    const senderInboxId = this.inbox.findIndex(i => i.name === sender);
    if(senderInboxId === -1) throw new Error(`Sender with name ${sender} not found`);
    for (let i = 0; i < this.inbox.length; ++i) {
      if(senderInboxId === i) continue;
      //TODO! Add a flag to terminated executors and remove them from the recipients list
      await this.mutex_inbox.lock();

      this.inbox[i].messages.push(data);
      if (this.inbox[i].mutex.locked > 0) {
        this.inbox[i].mutex.unlock();
      }

      this.mutex_inbox.unlock();
    }
  }

  async sendData(recipient, data) {
    await this.mutex_inbox.lock();

    const recipientInboxId = this.inbox.findIndex(i => i.name === recipient);
    if(recipientInboxId === -1) throw new Error(`Recipient with name ${recipient} not found`);
    this.inbox[recipientInboxId].messages.push(data);
    if (this.inbox[recipientInboxId].mutex.locked > 0) {
      this.inbox[recipientInboxId].mutex.unlock();
    }

    this.mutex_inbox.unlock();
  }

  async receiveData(inboxId, lock = true) {
    await this.mutex_inbox.lock();

    if (this.inbox[inboxId].messages.length === 0) {
      if (lock) {
        this.mutex_inbox.unlock();
        await this.inbox[inboxId].mutex.lock();
      } else {
        this.mutex_inbox.unlock();
        return [];
      }
    }

    let messages = this.inbox[inboxId].messages.splice(0);
    this.mutex_inbox.unlock();
    return messages;
  }

  releaseDeferredLock() {
    if (this.wcDeferredLock) this.wcDeferredLock.release();
  }

  async executeDeferredModules(stageId) {
    const deferredModules = this.wc.filter((wc) => wc.type === ModuleTypeEnum.DEFERRED);

    for (const module of deferredModules) {
      await module._witnessComputation(stageId);
    }
  }

  async witnessComputationDeferred(stageId) {
    return new Promise(async (resolve, reject) => {
      let _lastSolvedpayloadId;
      try {
        while (true) {
          await this.wcDeferredLock.lock();

          if (!this.airBus.hasPendingPayloads()) break;

          log.info(`[${this.name}]`, `Initiating the process to unblock witness calculators`);

          await this.executeDeferredModules(stageId);

          const lastSolvedpayloadId = this.lastSolvedpayloadId;
          if (_lastSolvedpayloadId === lastSolvedpayloadId) {
            log.error(
              `[${this.name}]`,
              "The executing processes do not respond, processes are stucked."
            );
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
};
