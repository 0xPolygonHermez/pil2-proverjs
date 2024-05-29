const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Executor1 extends BaseModule {
  constructor() {
    super("Executor1");
    this.E = false;
  }

  async witnessComputation() {
    this.publishMessage("general", "A");
    this.publishMessage("general", "D");

    await this.wait_until(() => this.E == true);
  }

  async onPublishedMessage(msg) {
    this.E = msg.data === "E";
  }
}

new Executor1();
