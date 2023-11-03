const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(wcManager, proofCtx) {
        super("Executor2", wcManager, proofCtx);
    }

    async witnessComputation(stageId, subproofId, airId, instanceId) {
        const payloads = this.wcManager.airBus.getPendingPayloadsByRecipient(this.name);

        for(const payload of payloads) {
            log.info(`[${this.name}]`, `Resolving payload: ${payload.payloadId}`);                
            this.wcManager.resolveBusPayload(payload.payloadId);
        }
    }
}