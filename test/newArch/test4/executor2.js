const { BaseModule, ModuleTypeEnum } = require("./base_module.js");

const log = require("../../../logger.js");

class Executor2 extends BaseModule {
    constructor() {
        super("Executor2", ModuleTypeEnum.LISTENER);
    }

    async dispatchEvent(source, event) {
        log.info(`[${this.name}]`, `Received the command ${JSON.stringify(event)} from ${source}`);        
    }
}

new Executor2();