const assert = require("assert");
const Subscriber = require("../../src/messaging/subscriber.js");
const MessageBroker = require("../../src/messaging/message_broker.js");
const Message = require("../../src/messaging/message.js");

describe("Subscriber", () => {
    let broker;
    let subscriber;

    beforeEach(() => {
        broker = new MessageBroker();
        broker.addTopic("test");
        subscriber = new Subscriber("Alice", broker);
    });

    // describe("#constructor", () => {
    //     it("should create a new subscriber with the given name and message broker", () => {
    //         assert.strictEqual(subscriber.name, "Alice");
    //         assert.strictEqual(subscriber.messageBroker, broker);
    //         assert.deepStrictEqual(subscriber.inbox, []);
    //     });

    //     it("should add the subscriber to the message broker", () => {
    //         assert.strictEqual(broker.subscribers.size, 1);
    //         console.log(broker.subscribers.get("Alice"));
    //         console.log(subscriber.publish.bind(subscriber));
    //         assert.strictEqual(
    //             broker.subscribers.get("Alice"),
    //             subscriber.publish.bind(subscriber)
    //         );
    //     });

    //     it("should add a topic with the subscriber's name to the message broker", () => {
    //         assert.ok(broker.subscriptions.has("Alice"));
    //     });
    // });

    describe("#subscribeTo", () => {
        it("should subscribe the subscriber to the given topic", () => {
            subscriber.subscribeTo("test");
            assert.ok(
                broker.subscriptions.get("test").includes(subscriber.name)
            );
        });
    });

    //   describe("#addMessageToInbox", () => {
    //     it("should add the given envelope to the subscriber's inbox", () => {
    //       const envelope = { sender: "Bob", recipient: "Alice", payload: { message: "Hello, world!" } };
    //       subscriber.addMessageToInbox(envelope);

    //       assert.deepStrictEqual(subscriber.inbox, [envelope]);
    //     });
    //   });

    //   describe("#publish", () => {
    //     it("should publish the given message to the message broker", () => {
    //       const message = new Message("notification", "test", { message: "Hello, world!" });
    //       subscriber.publish("test", message);

    //       assert.deepStrictEqual(broker.inbox, [{ sender: "Alice", recipient: "test", payload: message }]);
    //     });

    //     it("should throw an error for an invalid message type", () => {
    //       const message = "invalid";

    //       assert.throws(() => {
    //         subscriber.publish("test", message);
    //       }, /Invalid message type: invalid/);
    //     });
    //   });

    //   describe("#hasMessage", () => {
    //     it("should return true if the subscriber has messages in their inbox", () => {
    //       subscriber.addMessageToInbox({ sender: "Bob", recipient: "Alice", payload: { message: "Hello, world!" } });

    //       assert.strictEqual(subscriber.hasMessage(), true);
    //     });

    //     it("should return false if the subscriber has no messages in their inbox", () => {
    //       assert.strictEqual(subscriber.hasMessage(), false);
    //     });
    //   });

    //   describe("#getMessage", () => {
    //     it("should remove and return the first message from the subscriber's inbox", () => {
    //       const envelope1 = { sender: "Bob", recipient: "Alice", payload: { message: "Hello, world!" } };
    //       const envelope2 = { sender: "Bob", recipient: "Alice", payload: { message: "Goodbye, world!" } };
    //       subscriber.addMessageToInbox(envelope1);
    //       subscriber.addMessageToInbox(envelope2);

    //       assert.deepStrictEqual(subscriber.getMessage(), envelope1);
    //       assert.deepStrictEqual(subscriber.inbox, [envelope2]);
    //     });

    //     it("should return null if the subscriber has no messages in their inbox", () => {
    //       assert.strictEqual(subscriber.getMessage(), null);
    //     });
    //   });
});
