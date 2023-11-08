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
        this.type = type;

        // Variables related to the parent module
        this.parentPort = parentPort;
        this.mutex = new Mutex();
        this.tasks = [];

        // Incoming sessions
        this.inSessions = [];

        // Outgoing sessions
        this.outSessions = [];

        parentPort.on("message", async (event) => await this.onParentMessage(event));
    }

    // CHILD COMMANDS: Commands to be called by the child module
    openSession(destination) {
        this.outSessions[destination] = new MessageChannel();

        this.sendParentCommand("open_session", { dest: destination, port: this.outSessions[destination].port2 }, [this.outSessions[destination].port2]);
    }

    closeSession(destination) {
        this.outSessions[destination].port1.postMessage({ command: 'close_session' });
    }

    sendCommand(destination, command) {
        this.outSessions[destination].port1.postMessage(command);
    }

    sendParentCommand(command, params, transferList = []) {
        this.parentPort.postMessage({ command: command, params: { src: this.name, ...params }}, transferList);
    }

    async sendPendingJob(job, lock) {
        this.sendParentCommand('pending_job', { src: this.name, job: job, lock:lock });
        
        if(lock) {
            const session = this.inSessions.find((session) => session.source === job.src);
            if(session === undefined) {
                log.error(`[${this.name}]`, `sendPendingJob Session not open with ${job.src}`);
                return;
            }
            await session.lockMutex.lock();
        }
    }

    async witnessComputation() {}

    async _witnessComputation() {
        await this.witnessComputation();

        if(this.type === ModuleTypeEnum.REGULAR)
            this.sendParentCommand("change_state", { state: "finished" });
    }

    async dispatchParentEvent() {
        const event = this.tasks.shift();
        // log.info(`[${this.name}]`, "Received command from", event.params?.src, ":", event.command);
        switch(event.command) {
            case "run":
                await this._witnessComputation();
                break;
            case "open_session":
                this.openSessionCmd(event);
                break;
            default:
        };
    }

    openSessionCmd(event) {
        const source = event.params.src;

        if(this.inSessions.length > 0) {
            const session = this.inSessions.find((session) => session.source === source);
            if(session) {
                log.error(`[${this.name}]`, `openSessionCmd Session already open with ${source}`);
                return;
            }
        }

        this.inSessions.push({ source: source, port: event.params.port, mutex: new Mutex(), lockMutex : new Mutex(), tasks: [] });

        event.params.port.on("message", async (msg) => {
            await this.onSessionMessage(msg, source);
        });
    }

    async onSessionMessage(msg, source) {
        const session = this.inSessions.find((session) => session.source === source);

        if(!session) {
            log.error(`[${this.name}]`, `onSessionMessage Session not open with ${source}`);
            return;
        }

        session.tasks.push(msg);
        await session.mutex.lock();
        const task = session.tasks.shift();

        if(task.command === "close_session")
            this.closeSessionCmd({ params: { src: source }});
        else
            await this.dispatchSessionMsg(source, task);

        session.mutex.unlock();
    }

    async onParentMessage(event) {
        if(event.command === "unlock") {
            const session = this.inSessions.find((session) => session.source === event.src);

            if(session !== undefined) session.lockMutex.unlock();
            return;
        }

        this.tasks.push(event);
        await this.mutex.lock();
        await this.dispatchParentEvent();
        this.mutex.unlock();
    }

    closeSessionCmd(event) {
        const source = event.params.src;

        const sessionIdx = this.inSessions.findIndex((session) => session.source === source);

        this.inSessions.splice(sessionIdx, 1);

        if(this.inSessions.length === 0) {
            this.sendParentCommand("change_state", { state: "listening" });
        } else {
            this.sendParentCommand("close_session", { dest: source });
        }
    }
}

module.exports = {
    BaseModule,
    ModuleTypeEnum
}