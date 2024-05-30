const { Worker } = require("worker_threads");
const TargetLock = require("../../../src/concurrency/target_lock.js");
const Envelope = require("./envelope.js");

const log = require("../../../logger.js");

const path = require("path");
const fs = require("fs");

const WorkerStatusEnum = {
  RUNNING: 1,
  TERMINATED: 2,
};

const MsgTypeEnum = {
  COMMAND: "command",
  NOTIFICATION: "notification",
};

const CommandsEnum = {
  PUBLISH: "publish",
  WITNESS_COMPUTATION: "witness_computation",
  TERMINATE: "terminate",
};

const NotificationsEnum = {
  TERMINATED: "terminated",
};

class WCManager {
  constructor() {
    this.name = "wcManager";
    this.modules = [];
    this.target_lock;

    // Subscribers store information related to topics and subscribers
    this.subscribers = new Map();
    this.listeners = 0;
  }

  async run(modules) {
    for (const module of modules) {
      const module_path = path.isAbsolute(module.filename)
        ? module.filename
        : path.join(__dirname, module.filename);

      // Check file exists
      if (!fs.existsSync(module_path)) {
        log.error(`[${this.name}]`, `Module ${module_path} does not exist.`);
        throw new Error(`Module ${module_path} does not exist.`);
      }

      if (this.modules.find((mod) => mod.name === module.name)) {
        log.error(`[${this.name}]`, "Module already exists '" + module.name + "'");
        throw new Error("Module already exists '" + module.name + "'");
      }
      const worker = new Worker(module_path);
      worker.on("message", async (msg) => {
        await this.dispatchMessage(msg);
      });

      // Subscribe all modules to general topic
      this.subscribe("general", module.name, worker);

      if (module.settings.kind && module.settings.kind === "listener") {
        this.listeners += 1;
        this.subscribe("listeners", module.name);
      }

      if (module.settings.channels) {
        for (const channel of module.settings.channels) {
          if (channel === "listeners" || channel === "general") {
            log.error(`[${this.name}]`, `Channel name ${channel} is reserved.`);
            throw new Error(`Channel name ${channel} is reserved.`);
          }
          this.subscribe(channel, module.name, worker);
        }
      }

      this.modules.push({ name: module.name, worker: worker, status: WorkerStatusEnum.RUNNING });
    }

    await this.witnessComputation(0);

    for (const module of this.modules) module.worker.terminate();
  }

  witnessComputation(stageId) {
    return new Promise(async (resolve, reject) => {
      try {
        this.target_lock = new TargetLock(this.modules.length, 0);

        for (const module of this.modules)
          this.sendCommand(module.name, {
            command: CommandsEnum.WITNESS_COMPUTATION,
            stage_id: stageId,
          });

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
    if (msg.type === MsgTypeEnum.COMMAND) {
      await this.dispatchCommandMessage(msg);
    } else if (msg.type === MsgTypeEnum.NOTIFICATION) {
      await this.dispatchNotificationMessage(msg);
    } else {
      log.error(`[${this.name}]`, "Unknown message type: " + msg.type);
      throw new Error("Unknown message type: " + msg.type);
    }
  }

  async dispatchCommandMessage(msg) {
    const payload = msg.payload;

    switch (payload.command) {
      case CommandsEnum.PUBLISH:
        this.publish(msg.sender, MsgTypeEnum.NOTIFICATION, msg.recipient, payload.payload);
        break;
      default:
        log.error(`[${this.name}]`, "Unknown command: " + command);
    }
  }

  async dispatchNotificationMessage(msg) {
    const sender = msg.sender;

    let module = this.checkModuleExist(sender);

    switch (msg.payload.type) {
      case NotificationsEnum.TERMINATED:
        log.info(sender + " terminated");
        module.status = WorkerStatusEnum.TERMINATED;
        this.target_lock.release();

        if (this.target_lock.locked == this.listeners) {
          // NOTE: Listeners cannot depend on other listeners to finish
          this.publish(this.name, MsgTypeEnum.COMMAND, "@listeners", {
            command: CommandsEnum.TERMINATE,
          });
        }
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

  sendCommand(module_name, command_payload) {
    let module = this.checkModuleExist(module_name);
    const envelope = new Envelope(this.name, module_name, MsgTypeEnum.COMMAND, command_payload);
    module.worker.postMessage(envelope);
  }

  subscribe(topic, module_name) {
    if (!topic.startsWith("@")) {
      topic = "@" + topic;
    }

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }

    this.subscribers.get(topic).push(module_name);
    // log.info(`${module_name} subscribed to topic ${topic}`);
  }

  publish(src, msg_type, topic, payload) {
    if (this.subscribers.has(topic)) {
      let msg = { channel: topic, payload };
      this.subscribers.get(topic).forEach((subscriber) => {
        let module = this.checkModuleExist(subscriber);
        if (module.name !== src && module.status === WorkerStatusEnum.RUNNING) {
          const envelope = new Envelope(src, module.name, MsgTypeEnum.NOTIFICATION, msg, topic);

          module.worker.postMessage(envelope);
        }
      });
      // log.info(`Published message to topic ${topic}`);
    }
  }
}

module.exports = {
  WCManager,
  WorkerStatusEnum,
  MsgTypeEnum,
  CommandsEnum,
  NotificationsEnum,
};
