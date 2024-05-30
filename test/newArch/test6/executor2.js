const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Executor2 extends BaseModule {
  constructor() {
    super("Executor2");
    this.B = false;
  }

  async witnessComputation(stageId) {
    await this.wait_until(() => this.B == true);

    this.publishMessage("general", "C");
    this.prove("logup", 2, [20, 30], 40);
  }

  async onPublishedMessage(msg) {
    this.B = msg.payload === "B";
  }
}

new Executor2();