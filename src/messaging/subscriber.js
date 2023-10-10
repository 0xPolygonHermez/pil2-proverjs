const log = require("../../logger.js");

class Subscriber {
    constructor(name, messageBroker) {
        this.name = name;
        this.messageBroker = messageBroker;
        this.inbox = [];

        this.messageBroker.addTopic(name);
        this.messageBroker.addSubscriber(this);
    }

    subscribeTo(topic) {
        this.messageBroker.subscribeTo(this, topic);
    }

    addMessageToInbox(envelope) {
        this.inbox.push(envelope);
    }

    publish(topic, message) {
        if (message.constructor.name !== "Message") {
            log.error(`Invalid message type: ${message}`);
            throw new Error(`Invalid message type: ${message}`);
        }

        this.messageBroker.publish(this, topic, message);
    }

    hasMessage() {
        return this.inbox.length > 0;
    }

    getMessage() {
        return this.inbox.shift();
    }
}

module.exports = Subscriber;