const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");


class Executor1 extends BaseModule {
  constructor() {
    super("Executor1");
    this.A = false;
  }

  async witnessComputation(stageId) {
    //....
    await this.wait_until(() => this.A == true);

    this.prove("logup", 1, [2, 3], 4);

    this.publishMessage("general", "B");
  }

  async onPublishedMessage(msg) {
    this.A = msg.payload === "A";
  }
}

new Executor1();
