const ModuleNewComponent = require("../module_new_component.js");

class Executor2 extends ModuleNewComponent {
    constructor(wcManager, proofCtx) {
        super("Executor2", wcManager, proofCtx);
    }

    async run() {
        this.setNewState(ModuleStateEnum.WAITING);
        console.log("Executor2");
        this.setNewState(ModuleStateEnum.FINISHED);
    }
}

module.exports = Executor2;