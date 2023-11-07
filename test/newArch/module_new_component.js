//const log = require("../logger.js");

const { WitnessCalculatorComponent } = require("../../src/witness_calculator_component.js");

const ModuleStateEnum = {
    INIT: 1,
    WAITING: 2,
    FINISHED: 3,
    SESSION: 4,
};

class ModuleNewComponent extends WitnessCalculatorComponent {
    constructor(name, wcManager, proofCtx) {
        super(name, wcManager, proofCtx);

        this.state = ModuleStateEnum.INIT;
    }
    
    setNewState(state) {
        const transitions = [];
        transitions[ModuleStateEnum.INIT] = [ModuleStateEnum.WAITING, ModuleStateEnum.FINISHED];
        transitions[ModuleStateEnum.WAITING] = [ModuleStateEnum.SESSION];
        transitions[ModuleStateEnum.SESSION] = [ModuleStateEnum.WAITING];
        transitions[ModuleStateEnum.FINISHED] = [];

        if(!transitions[this.state].includes(state)) {
            throw new Error(`Invalid transition from ${this.state} to ${state}`);
        }

        this.state = state;
    }
}

module.exports = { ModuleNewComponent, ModuleStateEnum };
