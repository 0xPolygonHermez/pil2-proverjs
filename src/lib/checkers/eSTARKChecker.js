const CheckerComponent = require("../../checker.js");
const log = require('../../../logger.js');

class CheckerA extends CheckerComponent {
    constructor(proofmanagerAPI) {
        super("FRI Checker", proofmanagerAPI);
        this.initialized = false;
    }

    initialize() {
        super.initialize();
    }

    check(proof) {
        this.checkInitialized();

        log.info(`[${this.name}]`, "Checking.");
        return true;

    }
}

module.exports = CheckerA;