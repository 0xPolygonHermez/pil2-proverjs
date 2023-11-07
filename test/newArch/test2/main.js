// main.js
const { Worker } = require("worker_threads");

const myWorker = new Worker("./test/newArch/test2/worker.js");

let nMessages = 0;

myWorker.on("message", (result) => {
    console.log("Result received from worker:", result);
    nMessages++;
    if(nMessages === 2 ) myWorker.terminate();
});

myWorker.postMessage([13, 17]);
console.log("Message posted to worker");
myWorker.postMessage([7, 3]);
console.log("Message posted to worker");
