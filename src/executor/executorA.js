const { ExecutorComponent } = require("./executor.js");

class ExecutorA extends ExecutorComponent {
    constructor() {
        super("Executor Type A");
    }

    witnessComputation() {
        console.log(`Executor ${this.name}: Resolving constraints...`);
    }
}

module.exports = ExecutorA;