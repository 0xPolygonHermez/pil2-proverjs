module.exports = class AsyncAccLock {
    constructor() {
        this.queue = [];
        this.locked = 0;
    }

    async lock() {
        return new Promise((resolve) => {
            if (this.locked++ < 0) {
                resolve();
            } else {
                this.queue.push(resolve);
            }
        });
    }

    unlock() {
        this.locked--;
        this.queue.shift()();
    }
};