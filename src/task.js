const log = require('../logger.js');

const NOTIFICATION_TYPE = "notification";

class Task {
    constructor(sender, recipient, type, tag, data, promise = null) {
        this.sender = sender;
        this.recipient = recipient;
        this.type = type;
        this.tag = tag;
        this.data = data;
        this.promise = promise;
    }
}

module.exports = {
    Task,
    NOTIFICATION_TYPE,
};