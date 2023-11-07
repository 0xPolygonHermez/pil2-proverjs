// worker.js
const { parentPort } = require("worker_threads");

let n = 0;
parentPort.on("message", (numbers) => {
    n++;
    const time = n > 1 ? 1 : 1000;
    console.log(`Waiting ${time}ms`);

    setTimeout(() => {
        const result = numbers[0] * numbers[1];
        parentPort.postMessage(result);    
    }, time);
});
