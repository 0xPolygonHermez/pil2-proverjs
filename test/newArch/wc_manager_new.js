const WitnessCalculatorFactory = require('../../src/witness_calculator_factory.js');

const Mutex = require('../../src/concurrency/mutex.js')
const AsyncAccLock = require('../../src/concurrency/async_acc_lock.js');

const path = require("path");

module.exports = class WitnessCalculatorManagerNew {
    constructor() {
        this.wc = [];
        this.proofCtx = {};

        this.mutex = new Mutex();

        this.stateTable = [];        
        this.wcLocks = [];
        this.wcCondVar;
    }

    async run(modules) {
        console.log("Hello world!");

        for(const module of modules) {
            const filename = path.join(__dirname, module.filename);
            const newWitnessCalculator = await WitnessCalculatorFactory.createWitnessCalculator(filename, this, this.proofCtx);
    
            this.wc.push(newWitnessCalculator);
            this.wcLocks.push(new AsyncAccLock());
        }

        for(const wc of this.wc) {
            await wc.run();
        }
    }

    openSession(source, target) {
        // Check if the module acceps sessions, modules that accept sessions must be in waiting state at the beginning of the session?

        // wcCondVar ++

        // this.setState(SESSION);
        
    }

    closeSession() {}

    addCommand() {}
    resolveCommand() {}

    addNotification() {}
    resolveNotification() {}

    readData() {}
    writeData() {}
    
    resolveData() {}
};