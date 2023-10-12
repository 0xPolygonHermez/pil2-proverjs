var Mutex = require("../../src/mutex.js");

const mutex = new Mutex(true);

let A = null;

async function executor1() {
    if (A === null) {
        console.log("Waiting for A to be set");
        await mutex.lock();
    }
    A++;
    console.log("A", A);
}

async function executor2() {
    try {
        console.log("Setting A");
        A = 1;
    } finally {
        mutex.unlock();
    }
}

async function witnessComputation() {
    await Promise.all([executor1(), executor2()]);
    console.log("Done!");
}

witnessComputation().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

  