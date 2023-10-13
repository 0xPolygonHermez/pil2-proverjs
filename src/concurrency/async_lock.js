module.exports = class AsyncLock {
    constructor() {
        this.queue = [];
        this.locked = false;
    }

    async lock() {
        return new Promise((resolve) => {
            if (this.locked) {
                this.queue.push(resolve);
            } else {
                this.locked = true;
                resolve();
            }
        });
    }

    unlock() {
        if (this.queue.length > 0) {
            const resolve = this.queue.shift();
            resolve();
        } else {
            this.locked = false;
        }
    }
};