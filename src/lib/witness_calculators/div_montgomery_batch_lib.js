const { WitnessCalculatorComponent, ModuleTypeEnum } = require("../../witness_calculator_component.js");

const log = require("../../../logger.js");

module.exports = class DivModule extends WitnessCalculatorComponent {
    constructor(wcManager, proofSharedMemory) {
        super("divLib", wcManager, proofSharedMemory, ModuleTypeEnum.DEFERRED);
    }

    async witnessComputation(stageId, airCtx, instanceId) {
        const payloads = this.getBusPayloadsByRecipient(this.name);

        for(const payload of payloads) {
            log.info(`[${this.name}]`, ` Resolving payload: ${payload.payloadId}`);
            this.resolveBusPayload(payload.payloadId);
        }
    }
}