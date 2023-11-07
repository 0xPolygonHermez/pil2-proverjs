// worker.js
const { parentPort } = require("worker_threads");
const Mutex = require("../../../src/concurrency/mutex");

const log = require("../../../logger.js");

const ModuleTypeEnum = {
    REGULAR: 1,
    LISTENER: 2,
};

class BaseModule {
    constructor(name, type = ModuleTypeEnum.REGULAR) {
        this.name = name;
        this.tasks = [];
        this.mutex = new Mutex();
        this.sessions = [];
        this.type = type;

        this.channels = [];

        this.parentPort = parentPort;

        parentPort.on("message", async (event) => {
            this.tasks.push(event);
            await this.mutex.lock();
            await this.dispatchParentEvent();
            this.mutex.unlock();
        }); 
    }

    openSession(destination) {
        this.channels[destination] = new MessageChannel();

        this.sendParentCommand("open_session", { dest: destination, port: this.channels[destination].port2 }, [this.channels[destination].port2]);
    }

    closeSession(destination) {
        this.channels[destination].port1.postMessage('close_session');  
    }

    sendParentCommand(command, params, transferList = []) {
        this.parentPort.postMessage({ command: command, params: { src: this.name, ...params }}, transferList);
    }

    sendCommand(destination, command) {
        this.channels[destination].port1.postMessage(command);
    }

    async witnessComputation() {}

    async _witnessComputation() {
        await this.witnessComputation();

        if(this.type === ModuleTypeEnum.REGULAR)
            this.sendParentCommand("change_state", { state: "finished" });
    }

    async dispatchParentEvent() {
        const event = this.tasks.shift();
        //log.info(`[${this.name}]`, "Received command from", event.params?.src, ":", event.command);
        switch(event.command) {
            case "run":
                await this._witnessComputation();
                break;
            case "open_session":
                this.openSessionCmd(event);
                break;
            case "close_session":
                this.closeSessionCmd(event);
                break;
            default:
                this.witnessComputation(event);
        };
    }

    openSessionCmd(event) {
        const source = event.params.src;

        if(this.sessions.length > 0) {
            // console.log(this.sessions);
            const session = this.sessions.find((session) => session.source === source);
            if(session) {
                //log.error(`[${this.name}]`, `Session already open with ${source}`);
                return;
            }
        }

        this.sessions.push({ source: source, port: event.params.port });
        event.params.port.on("message", async (msg) => {
            this.tasks.push(msg);
            await this.mutex.lock();
            const task = this.tasks.shift();
            if(task === "close_session") {
                this.closeSessionCmd({ params: { src: source }});
            } else await this.dispatchEvent(source, task);
            this.mutex.unlock();
        });
    }

    closeSessionCmd(event) {
        const source = event.params.src;

        const sessionIdx = this.sessions.findIndex((session) => session.source === source);

        this.sessions.splice(sessionIdx, 1);

        if(this.sessions.length === 0) {
            this.sendParentCommand("change_state", { state: "listening" });
        } else {
            this.sendParentCommand("closing_session", { dest: source });
        }
    }
}

module.exports = {
    BaseModule,
    ModuleTypeEnum,
}