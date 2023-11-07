// main.js
const { Worker, MessageChannel } = require('worker_threads');

const worker = new Worker('./test/newArch/test3/worker.js');

const channels = [];
channels.push(new MessageChannel());

worker.postMessage({ command: "addPort", port: channels[0].port1 }, [channels[0].port1]);

channels[0].port2.on('message', (result) => {
  console.log('Result received from worker2:', result);
});

channels[0].port2.postMessage([13, 17]);
worker.postMessage({ command: "closePort" })
console.log('main.js is done');