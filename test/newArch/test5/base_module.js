// worker.js
const { parentPort } = require("worker_threads");
const Mutex = require("../../../src/concurrency/mutex.js");

const log = require("../../../logger.js");

class BaseModule {
  constructor(name) {
    this.name = name;

    // Variables related to the parent module
    this.parentPort = parentPort;
    this.mutex = new Mutex();

    this.mutex_condition = new Mutex();

    parentPort.on("message", async (event) => await this.onMessage(event));
  }

  sendCommand(command, params) {
    this.parentPort.postMessage({ src: this.name, command, params });
  }

  publishMessage(channel, data) {
    this.parentPort.postMessage({ src: this.name, command: "publish", channel, data });
  }

  async witnessComputation() {}

  async _witnessComputation(params) {
    await this.witnessComputation();

    this.sendCommand("finished");
  }

  async onMessage(msg) {
    if (msg.command) {
      await this._onCommandMessage(msg);
    } else if (msg.channel) {
      await this._onPublishedMessage(msg);
    }
  }

  async _onCommandMessage(msg) {
    switch (msg.command) {
      case "witness_computation":
        await this._witnessComputation(msg.params);
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
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

module.exports = BaseModule;
