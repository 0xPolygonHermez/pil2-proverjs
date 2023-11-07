// worker.js
const { parentPort } = require("worker_threads");
const Mutex = require("../../../src/concurrency/mutex");

let port;
let task = [];
let mutex = new Mutex();

parentPort.on("message", (event) => {
    task.push(event);
    mutex.lock().then(() => {
        dispatchEvent();
        task.shift();
        mutex.unlock();
    });
});

function dispatchEvent() {
    const event = task[0];
    console.log("CMD:", event.command);
    switch(event.command) {
        case "addPort":
            addPort(event);
            break;
        case "closePort":
            closePort(event);
            break;
        default:
            console.error('worker.js: unknown command:', event.command);
    };
}

function addPort(event) {
    port = event.port;

    port.on("message", (numbers) => {
        console.log('worker.js: numbers received:', numbers);
        const result = numbers[0] * numbers[1];
        port.postMessage(result);
        
    });
    port.postMessage('worker.js: port is ready');   
}

function closePort(event) {
    setTimeout(() => {
    port.close();
    process.exit();
    }, 100);
}