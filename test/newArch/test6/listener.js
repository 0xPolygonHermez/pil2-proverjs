const BaseModule = require("./base_module.js");

const log = require("../../../logger.js");

class Listener extends BaseModule {
  constructor() {
    super("Listener");
    this.terminate = false;
  }

  async witnessComputation(stageId) {
    await this.wait_until(() => this.terminate == true);
  }

  async onPublishedMessage(msg) {
    if (msg.channel === "@logup") {
      // ... todo
    } else {
      this.terminate = this.terminate || msg.payload.command === "terminate";
    }
  }
}

new Listener();
