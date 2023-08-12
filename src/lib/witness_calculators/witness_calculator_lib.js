const WitnessCalculatorLibComponent = require("../../witness_calculator_lib_component.js");
const log = require("../../../logger.js");

class WitnessCalculatorLib extends WitnessCalculatorLibComponent {
    constructor(proofmanagerAPI) {
        super("WCLib", proofmanagerAPI);
        
        this.subscribe("challenge1", [this.computeH1H2.bind(this)]);
        this.subscribe("challenge2", [this.computeZ.bind(this)]);
    }

    computeH1H2(stageId, subproofId, airId) {
        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofId, airId);
        log.info(`[${this.name}]`, `Air '${air.name}' Computing H1H2 at stage ${stageId}.`);
    }

    computeZ(stageId, subproofId, airId) {
        const air = this.proofmanagerAPI.getPilout().getAirBySubproofIdAirId(subproofId, airId);
        log.info(`[${this.name}]`, `Air '${air.name}' Computing Z at stage ${stageId}.`);
    }
}

module.exports = WitnessCalculatorLib;