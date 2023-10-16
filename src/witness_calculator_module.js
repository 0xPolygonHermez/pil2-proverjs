const { WitnessCalculatorComponent } = require("./witness_calculator_component.js");

const log = require("../logger.js");

module.exports = class WCModule extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCDeferredModule", proofmanagerAPI);
        this.lastSolvedTaskId;
    }

    async witnessComputation(stageId, airCtx, instanceId) {
            while(true) {
                await this.wcManager.lockDeferred();

                if(!this.wcManager.hasPendingTasks()) break;

                await this.wcManager.executeDeferredModules(stageId, airCtx, instanceId);

                const lastSolvedTaskId = this.wcManager.getLastSolvedTaskId();
                if(this.lastSolvedTaskId === lastSolvedTaskId) {
                    log.error(`${this.name}`, "The executing processes do not respond, processes are stucked.")
                    throw new Error("The executing processes do not respond, processes are stucked.");
                }   
                
                this.lastSolvedTaskId = lastSolvedTaskId;
            }
    }
}