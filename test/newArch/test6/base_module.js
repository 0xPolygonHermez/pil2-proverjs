const { parentPort } = require("worker_threads");
const Mutex = require("../../../src/concurrency/mutex.js");
const Envelope = require("./envelope.js");

const log = require("../../../logger.js");

const { WorkerStatusEnum, MsgTypeEnum, NotificationsEnum } = require("./wc_manager.js");

class BaseModule {
  constructor(name) {
    this.name = name;

    // Variables related to the parent module
    this.parentPort = parentPort;

    this.mutex_condition = new Mutex();

    parentPort.on("message", async (event) => await this.onMessage(event));

    this.status = WorkerStatusEnum.RUNNING;
  }

  sendNotification(notification, payload = undefined) {
    let msg_payload = { type: notification };
    if (payload !== undefined) msg_payload = { ...msg_payload, payload };
    const envelope = new Envelope(this.name, "wcManager", MsgTypeEnum.NOTIFICATION, msg_payload);

    this.parentPort.postMessage(envelope);
  }

  publishMessage(channel, payload = undefined) {
    let msg_payload = { command: "publish" };
    if (payload !== undefined) msg_payload = { ...msg_payload, payload };
    const envelope = new Envelope(this.name, `@${channel}`, MsgTypeEnum.COMMAND, msg_payload);

    this.parentPort.postMessage(envelope);
  }

  async witnessComputation() {}

  async _witnessComputation(stageId) {
    await this.witnessComputation(stageId);

    this.status = WorkerStatusEnum.FINISHED;
    this.sendNotification(NotificationsEnum.TERMINATED);
  }

  async onMessage(envelope) {
    if (this.status === WorkerStatusEnum.TERMINATED) {
      return;
    }

    let msg = envelope.payload;

    if (msg.command) {
      await this._onCommandMessage(msg);
    } else if (msg.channel) {
      await this._onPublishedMessage(msg);
    }
  }

  async _onCommandMessage(msg) {
    switch (msg.command) {
      case "witness_computation":
        await this._witnessComputation(msg.stage_id);
        break;
      default:
    }
  }

  async _onPublishedMessage(msg) {
    this.onPublishedMessage(msg);
    this.try_unlock_condition();
  }

  async wait_until(condition) {
    while (!condition()) {
      await this.mutex_condition.lock();
    }
  }

  try_unlock_condition() {
    if (this.mutex_condition.isLocked) {
      this.mutex_condition.unlock();
    }
  }

  assume(channel, ID, values, multiplicity) {
    let payload = { type: "assume", ID, values, multiplicity };

    this.publishMessage(channel, payload);
  }

  prove(channel, ID, values, multiplicity) {
    let payload = { type: "prove", ID, values, multiplicity };

    this.publishMessage(channel, payload);
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

module.exports = BaseModule;
