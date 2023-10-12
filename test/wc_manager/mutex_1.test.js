var Mutex = require("../../src/mutex.js");

const mutex = new Mutex(true);

let A = null;

async function executor1() {
    return new Promise(async (resolve) => {
        if (A === null) {
            console.log("Waiting for A to be set");
            await mutex.lock();
        }
        A++;
        console.log("A", A);
        resolve();
    });
}

async function executor2() {
    return new Promise(async (resolve) => {
        try {
            console.log("Setting A");
            A = 1;    
        } finally {
            mutex.unlock();
            resolve();
        }
    });
}

const ex1 = executor1();
const ex2 = executor2();

Promise.all([ex1, ex2]).then(() => {
    console.log("Done");
});
