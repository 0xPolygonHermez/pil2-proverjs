// main.js
const { Worker } = require("worker_threads");
const TargetLock = require("../../../src/concurrency/target_lock");
const Mutex = require("../../../src/concurrency/mutex");

const log = require("../../../logger.js");

module.exports = class WCManager {
    constructor() {
        this.modules = [];
        this.name = "wcManager"
        this.wcDeferredLock;
        this.mutex = new Mutex();
    }

    async run(modules) {
        let numListeners = 0;
        for(const module of modules) {
            const newWorker = new Worker(module.filename);
            const state = module.settings.type === "listener" ? "listening" : "initialized";
            if(state === "listening") numListeners++;
            this.modules.push({ name: module.name, worker: newWorker, state });
            newWorker.on("message", async (msg) => { await this.dispatchMessage(msg); });
        }

        this.wcDeferredLock = new TargetLock(modules.length - numListeners, 0);

        for(const module of this.modules) module.worker.postMessage({ command: "run" });

        await this.witnessComputation(0);

        for(const module of this.modules) module.worker.terminate();
    }

    checkModuleExist(moduleName) {
        const index = this.modules.findIndex(module => module.name === moduleName);
        if(index === -1) {
            log.error(`[${this.name}]`, "Module not found '" + moduleName + "'");
            throw new Error("Module not found '" + moduleName + "'");
        }

        return this.modules[index];
    }

    witnessComputation(stageId) {
        return new Promise(async (resolve, reject) => {
            try {
                while(true) {
                    log.info(`[${this.name}]`, "Locking")

                    await this.wcDeferredLock.lock();

                    log.info(`[${this.name}]`, "Unlocking")
    
                    break;

                    // log.info(`[${this.name}]`, `Initiating the process to unblock witness calculators`);

                    // await this.executeDeferredModules(stageId);
    
                    // const lastSolvedpayloadId = this.lastSolvedpayloadId;
                    // if(_lastSolvedpayloadId === lastSolvedpayloadId) {
                    //     log.error(`[${this.name}]`, "The executing processes do not respond, processes are stucked.")
                    //     throw new Error("The executing processes do not respond, processes are stucked.");
                    // }   
                    // _lastSolvedpayloadId = lastSolvedpayloadId;
                }
                setTimeout(() => {resolve();}, 100);
            } catch (err) {
                log.error(`[${this.name}]`, `Witness computation failed.`, err);
                reject(err);
            }
        });
    }

    // MESSAGE DISPATCHER
    async dispatchMessage(msg) {
        const command = msg.command;

        switch(command) {
            case "open_session":
                await this.openSessionCmd(msg);
                break;
            case "close_session":
                await this.closeSessionCmd(msg);
                break;
            case "closing_session":
                await this.closingSessionCmd(msg);
                break;
                case "change_state":
                await this.changeStateCmd(msg);
                break;
            default:
                log.error(`[${this.name}]`, "Unknown command: " + command);
        }
    }

    async openSessionCmd(msg) {
        log.info(`[${this.name}]`, `${msg.command} : ${msg.params.src} --> ${msg.params.dest} `);
        const dest = msg.params.dest;
        const module =this.checkModuleExist(dest);

        await this.changeStateCmd({ command: "change_state", params: { src: dest, state: "session" } });

        module.worker.postMessage({ command: "open_session", params: msg.params }, [msg.params.port]);
    }

    async closeSessionCmd(msg) {
        log.info(`[${this.name}]`, `${msg.command} : ${msg.params.src} x-> ${msg.params.dest} `);
        const dest = msg.params.dest;
        const module =this.checkModuleExist(dest);

        module.worker.postMessage({ command: "close_session", params: msg.params });
    }

    async closingSessionCmd(msg) {
        log.info(`[${this.name}]`, `${msg.command} : ${msg.params.src} <-x ${msg.params.dest} `);
        const dest = msg.params.dest;

        await this.mutex.lock();
        log.info(`[${this.name}]`, "--- Releasing because of closing session")
        this.wcDeferredLock.release();
        this.mutex.unlock();        
    }

    async changeStateCmd(msg) {
        await this.mutex.lock();
        const module =this.checkModuleExist(msg.params.src);
        const newState = msg.params.state;

        if(newState !== module.state) {
            log.info(`[${this.name}]`, `${msg.command} : ${msg.params.src}(${msg.params.state})`);
            module.state = newState;
        }

        if(["listening", "finished"].includes(module.state)) {
            log.info(`[${this.name}]`, `--- Releasing because of ${msg.params.src}(${newState})`);
            this.wcDeferredLock.release();
        }
        else if(["session"].includes(module.state)) {
            log.info(`[${this.name}]`, `+++ Acquiring because of ${msg.params.src}(${newState})`);
            this.wcDeferredLock.acquire();
        }

        this.mutex.unlock();
    }
};
