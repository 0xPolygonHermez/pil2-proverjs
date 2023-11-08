const { BaseModule } = require("./base_module.js");

const log = require("../../../logger.js");

class Executor1 extends BaseModule {
    constructor() {
        super("Executor1");
    }

    async witnessComputation() {
        const destination = "Executor2";

        this.openSession(destination);

        this.sendCommand(destination, { command: 'create_instance'});

        this.closeSession(destination);
    }
}

new Executor1();
