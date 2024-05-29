// main.js
const { Worker } = require("worker_threads");
const TargetLock = require("../../../src/concurrency/target_lock.js");

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
          this.sendCommand(module.worker, "witness_computation", { stage_id: stageId });

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
    const command = msg.command;
    // log.debug(`[${this.name}]`, `Received command: ${command}`);

    this.checkModuleExist(msg.src);

    switch (command) {
      case "publish":
        this.publish(msg.src, msg.channel, msg.data);
        break;
      case "finished":
        log.info(msg.src + " finished");
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

  sendCommand(module, command, params) {
    module.postMessage({ src: this.name, command: command, params });
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
      let msg = { src, channel: topic, data };
      this.subscribers.get(topic).forEach((subscriber) => {
        if (subscriber.name !== src) subscriber.worker.postMessage(msg);
      });
      log.info(`Published message to topic ${topic}`);
    }
  }
};
