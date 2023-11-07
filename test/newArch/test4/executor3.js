const { BaseModule } = require("./base_module.js");

const log = require("../../../logger.js");

class Executor3 extends BaseModule {
    constructor() {
        super("Executor3");
    }

    async witnessComputation() {
        const destination = "Executor2";

        this.openSession(destination);

        this.closeSession(destination);
    }
}

new Executor3();
