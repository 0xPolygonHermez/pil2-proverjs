const { WitnessCalculatorComponent } = require("./witness_calculator_component.js");

const log = require("../logger.js");

module.exports = class WCModule extends WitnessCalculatorComponent {
    constructor(proofmanagerAPI) {
        super("WCDeferredModule", proofmanagerAPI);
    }

    async witnessComputation(stageId, airCtx, airInstanceId) {
        return new Promise(async (resolve) => {
            log.info(`[${this.name}]`, `Starting stageId: ${stageId}, airCtx: ${airCtx}, airInstanceId: ${airInstanceId}`);

            let i =0;
            while(true) {
                await this.wcManager.lockDeferred();

                if(!this.wcManager.hasPendingTasks()) break;

                if(i==0) {
                    this.wcManager.writeData(this, "A", 7);
                } else if(i==1) {
                    this.wcManager.writeData(this, "B", 7);
                } else 
                    throw new Error("Unexpected");
                i++;
            }

            resolve();
            log.info(`[${this.name}]`, "Finishing");
        });
    }
}