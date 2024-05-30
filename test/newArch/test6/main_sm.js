const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Main extends BaseModule {
  constructor() {
    super("Main");
    this.C = false;
  }

  async witnessComputation(stageId) {
    // ...

    this.publishMessage("general", "A");

    this.assume("logup", 1, [2, 3], 4);
    this.assume("logup", 2, [20, 30], 40);

    await this.wait_until(() => this.C == true);
  }

  async onPublishedMessage(msg) {
    this.C = msg.payload === "C";
  }
}

new Main();
