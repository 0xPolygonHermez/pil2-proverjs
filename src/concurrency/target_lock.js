module.exports = class TargetLock {
    constructor(initialValue = 0, targetValue = undefined) {
        this.resolve;
        this.locked = initialValue;
        this.targetValue = targetValue;
    }

    async lock() {
        if(this.locked === this.targetValue) {
            return new Promise((resolve) => {
                this.resolve = resolve;
            });
        }
    }

    acquire() {
        this.locked++;
    }

    release() {
        const numLock = --this.locked;
        if (!this.targetValue || numLock === this.targetValue) {
            if(this.resolve) {
                this.resolve();
                this.resolve = undefined;
            }
        }
    }
};