const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Executor3 extends BaseModule {
  constructor() {
    super("Executor3");
    this.B = false;
  }

  async witnessComputation() {
    await this.wait_until(() => this.B);

    this.publishMessage("general", "C");
  }

  async onPublishedMessage(msg) {
    this.B = msg.data === "B";
  }
}

new Executor3();
