module.exports = class Mutex {
    constructor(isLocked = false) {
        this.queue = [];
        this.isLocked = isLocked;
    }
    async lock() {
        if (!this.isLocked) {
            this.isLocked = true;
            return;
        }
        return new Promise((resolve) => {
            this.queue.push(resolve);
        });
    }

    unlock() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        } else {
            this.isLocked = false;
        }
    }
};
