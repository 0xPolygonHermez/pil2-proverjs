const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Executor4 extends BaseModule {
  constructor() {
    super("Executor4");
    this.C = false;
    this.D = false;
  }

  async witnessComputation() {
    await this.wait_until(() => this.C && this.D);
    this.publishMessage("general", "E");
  }

  async onPublishedMessage(msg) {
    this.C = this.C || msg.data === "C";
    this.D = this.D || msg.data === "D";
  }
}

new Executor4();
