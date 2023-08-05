const { ExecutorComponent } = require("./executor.js");

class ExecutorB extends ExecutorComponent {
    constructor() {
        super("Executor Type B");
    }

    witnessComputation() {
        console.log(`Executor ${this.name}: Resolving constraints...`);
    }
}

module.exports = ExecutorB;