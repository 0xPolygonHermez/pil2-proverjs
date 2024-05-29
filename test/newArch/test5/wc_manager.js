// main.js
const { Worker } = require("worker_threads");
const TargetLock = require("../../../src/concurrency/target_lock.js");
const Envelope = require("./envelope.js");

const log = require("../../../logger.js");

module.exports = class WCManager {
  constructor() {
    this.name = "wcManager";
    this.modules = [];
    this.target_lock;

    // Subscribers store information related to topics and subscribers
    this.subscribers = new Map();
  }

  async run(modules) {
    for (const module of modules) {
      if (this.modules.find((mod) => mod.name === module.name)) {
        log.error(`[${this.name}]`, "Module already exists '" + module.name + "'");
        throw new Error("Module already exists '" + module.name + "'");
      }
      const worker = new Worker(module.filename);
      worker.on("message", async (msg) => {
        await this.dispatchMessage(msg);
      });

      // Subscribe all modules to general topic
      this.subscribe("general", module.name, worker);

      this.modules.push({ name: module.name, worker: worker });
    }

    await this.witnessComputation(0);

    for (const module of this.modules) module.worker.terminate();
  }

  witnessComputation(stageId) {
    return new Promise(async (resolve, reject) => {
      try {
        this.target_lock = new TargetLock(this.modules.length, 0);

        for (const module of this.modules)
          this.sendCommand(module.name, { command: "witness_computation", stage_id: stageId });

        await this.target_lock.lock();
        resolve();
      } catch (err) {
        log.error(`[${this.name}]`, `Witness computation failed.`, err);
        reject(err);
      }
    });
  }

  // COMMANDS DISPATCHER
  async dispatchMessage(msg) {
    const payload = msg.payload;
    const sender = msg.sender;
    // log.debug(`[${this.name}]`, `Received command: ${command}`);

    this.checkModuleExist(sender);

    switch (payload.command) {
      case "publish":
        this.publish(sender, payload.channel, payload.data);
        break;
      case "finished":
        log.info(sender + " finished");
        this.target_lock.release();
        break;
      default:
        log.error(`[${this.name}]`, "Unknown command: " + command);
    }
  }

  checkModuleExist(moduleName) {
    const index = this.modules.findIndex((module) => module.name === moduleName);
    if (index === -1) {
      log.error(`[${this.name}]`, "Module not found '" + moduleName + "'");
      throw new Error("Module not found '" + moduleName + "'");
    }

    return this.modules[index];
  }

  sendCommand(module_name, command) {
    let module = this.checkModuleExist(module_name);
    const envelope = new Envelope(this.name, module.name, command);
    module.worker.postMessage(envelope);
  }

  subscribe(topic, name, worker) {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }

    this.subscribers.get(topic).push({ name, worker });
    log.info(`${name} subscribed to topic ${topic}`);
  }

  publish(src, topic, data) {
    if (this.subscribers.has(topic)) {
      let msg = { channel: topic, data };
      this.subscribers.get(topic).forEach((subscriber) => {
        if (subscriber.name !== src) {
          const envelope = new Envelope(this.name, subscriber.name, msg);

          subscriber.worker.postMessage(envelope);
        }
      });
      log.info(`Published message to topic ${topic}`);
    }
  }
};
