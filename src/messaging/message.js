
const NOTIFICATION_MESSAGE_TYPE = "notification";
const NOTIFICATION_MESSAGE_EVENT = "event";

const log = require("../../logger.js");

class Message {
    constructor(type, tag, data) {
        if (![NOTIFICATION_MESSAGE_TYPE, NOTIFICATION_MESSAGE_EVENT].includes(type)) {
            log.error(`Invalid message type: ${type}`);
            throw new Error(`Invalid message type: ${type}`);
        }

        this.type = type;
        this.tag = tag;
        this.data = data;
    }

    static newNotificationMessage(tag, data) {
        return new Message(NOTIFICATION_MESSAGE_TYPE, tag, data);
    }

    static newEventMessage(tag, data) {
        return new Message(NOTIFICATION_MESSAGE_EVENT, tag, data);
    }
}

module.exports = Message;