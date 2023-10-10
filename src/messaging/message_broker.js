const { Subscriber } = require("./subscriber.js");
const { Envelope } = require("./envelope.js");
const { Message } = require("./message.js");

const log = require("../../logger.js");

class MessageBroker {
    constructor(initialTopics = ["broadcast"]) {
        this.subscriptions = new Map();
        this.subscribers = new Map();

        initialTopics.forEach((topic) => this.addTopic(topic));
    }

    addTopic(topic) {
        if (!this.subscriptions.has(topic)) {
            this.subscriptions.set(topic, []);
            log.info(`New topic ${topic} created`);
        }
    }

    addSubscriber(subscriber) {
        if (this.subscribers.has(subscriber.name)) {
            log.error(`Subscriber ${subscriber.name} already exists`);
            throw new Error(`Subscriber ${subscriber.name} already exists`);
        }

        this.subscribers.set(subscriber.name, subscriber.addMessageToInbox.bind(subscriber));
        log.info(`New subscriber ${subscriber.name} added`);
    }

    subscribeTo(subscriber, topic) {
        if (!this.subscribers.has(subscriber.name)) {
            log.error(`Subscriber ${subscriber.name} does not exist`);
            throw new Error(`Subscriber ${subscriber.name} does not exist`);
        }

        if (!this.subscriptions.has(topic)) {
            log.error(`Topic ${topic} does not exist`);
            throw new Error(`Topic ${topic} does not exist`);
        }

        this.subscriptions.get(topic).push(subscriber.name);
        log.info(`Subscriber ${subscriber.name} subscribed to topic ${topic}`);
    }

    publish(subscriber, topic, message) {
      if(message.constructor.name !== "Message") {
        log.error(`Invalid message type: ${message}`);
        throw new Error(`Invalid message type: ${message}`);
      }

        if (!this.subscribers.has(subscriber.name)) {
            log.error(`Subscriber ${subscriber.name} does not exist`);
            throw new Error(`Subscriber ${subscriber.name} does not exist`);
        }

        if (!this.subscriptions.has(topic)) {
            log.error(`Topic ${topic} does not exist`);
            throw new Error(`Topic ${topic} does not exist`);
        }

        if (!this.subscriptions.get(topic).includes(subscriber)) {
            log.error(`Subscriber ${subscriber.name} is not subscribed to topic ${topic}`);
            throw new Error(`Subscriber ${subscriber.name} is not subscribed to topic ${topic}`);
        }

        const envelope = new Envelope(subscriber, topic, message);

        this.subscriptions.get(topic).forEach((subscriber) => {
          if(subscriber.name !== envelope.sender) {
            this.subscribers.get(subscriber.name)(envelope);
          }
        });
    }
}

module.exports = MessageBroker;
// const broker = new MessageBroker();
// broker.addTopic("news");
// broker.addTopic("sports");
// const subscriber1 = new Subscriber("subscriber1", broker);
// subscriber1.subscribeTo("news");
// subscriber1.subscribeTo("sports");

// const subscriber2 = new Subscriber("subscriber2", broker);
// subscriber2.subscribeTo("news");

// subscriber1.publish("news", Message.newNotificationMessage("tag_notif", "Breaking news: JavaScript is awesome!"));
// subscriber1.publish("news", Message.newEventMessage("tag_event", "New Event!"));
// subscriber2.publish("news", Message.newNotificationMessage("tag3","Sports news: Final score 3-1"));

// while(subscriber1.hasMessage()) {
//   console.log("subscriber1", subscriber1.getMessage());
// }

// while(subscriber2.hasMessage()) {
//   console.log("subscriber2", subscriber2.getMessage());
// }
