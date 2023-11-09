const { BaseModule, ModuleTypeEnum } = require("./base_module.js");

const log = require("../../../logger.js");

class Executor2 extends BaseModule {
    constructor() {
        super("Executor2", ModuleTypeEnum.LISTENER);
    }

    async dispatchSessionMsg(source, msg) {
        //log.info(`[${this.name}]`, `Received command ${JSON.stringify(msg)} from ${source}`);

        switch(msg.command) {
            case "create_instance":
                await this.createInstance(source, msg);
                break;
        }
    }

    async createInstance(source, msg) {
        //log.info(`[${this.name}]`, `Creating new instance`);

        const lock = true;
        await this.sendPendingJob({ command: "resolve", params: { var: "A"}}, source, lock);
        await this.sendPendingJob({ command: "div_batch", params: { var: "A"}}, source, lock);
        await this.sendPendingJob({ command: "resolve", params: { var: "A"}}, source, lock);
    }
}

new Executor2();
