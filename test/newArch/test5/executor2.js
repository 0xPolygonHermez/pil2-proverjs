const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Executor2 extends BaseModule {
  constructor() {
    super("Executor2");
    this.A = false;
  }

  async witnessComputation() {
    await this.wait_until(() => this.A);

    this.publishMessage("general", "B");
  }

  async onPublishedMessage(msg) {
    this.A = msg.data === "A";
  }
}

new Executor2();
