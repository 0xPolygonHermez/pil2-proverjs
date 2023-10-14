const { WitnessCalculatorComponent } = require("./witness_calculator_component.js");

const log = require("../logger.js");

module.exports = class WCModule extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCDeferredModule", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
            let i =0;
            while(true) {
                await this.wcManager.lockDeferred();

                if(!this.wcManager.hasPendingTasks()) break;

                await this.wcManager.executeDeferredModules(stageId, airCtx, airInstanceId);
            }
    }
}