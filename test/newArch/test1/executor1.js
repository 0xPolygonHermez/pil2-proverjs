const { ModuleNewComponent, ModuleStateEnum } = require("../module_new_component.js");

module.exports = class Executor1 extends ModuleNewComponent {
    constructor(wcManager, proofCtx) {
        super("Executor1", wcManager, proofCtx);
    }

    async run() {
        this.setNewState(ModuleStateEnum.WAITING);
        console.log("Executor1");
        this.setNewState(ModuleStateEnum.FINISHED);
    }
}
