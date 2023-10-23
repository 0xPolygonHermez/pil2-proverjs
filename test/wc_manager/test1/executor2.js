const { WitnessCalculatorComponent } = require("../../../src/witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class Executor2 extends WitnessCalculatorComponent {
    constructor(wcManager, proofSharedMemory) {
        super("Executor2", wcManager, proofSharedMemory);
    }

    async witnessComputation(stageId, subproofCtx, airId, instanceId) {
        const payloads = this.getBusPayloadsByRecipient(this.name);

        for(const payload of payloads) {
            log.info(`[${this.name}]`, `Resolving payload: ${payload.payloadId}`);                
            this.resolveBusPayload(payload.payloadId);
        }
    }
}