const assert = require("assert");
const Message = require("../../src/messaging/message.js");

describe("Message", () => {
    describe("#constructor", () => {
        it("should create a new message with the given type, tag, and data", () => {
            const type = "notification";
            const tag = "test";
            const data = { message: "Hello, world!" };
            const message = new Message(type, tag, data);

            assert.strictEqual(message.type, type);
            assert.strictEqual(message.tag, tag);
            assert.deepStrictEqual(message.data, data);
        });

        it("should throw an error for an invalid message type", () => {
            const type = "invalid";
            const tag = "test";
            const data = { message: "Hello, world!" };

            assert.throws(() => {
                new Message(type, tag, data);
            }, /Invalid message type: invalid/);
        });
    });

    describe(".newNotificationMessage", () => {
        it("should create a new notification message with the given tag and data", () => {
            const tag = "test";
            const data = { message: "Hello, world!" };
            const message = Message.newNotificationMessage(tag, data);

            assert.strictEqual(message.type, "notification");
            assert.strictEqual(message.tag, tag);
            assert.deepStrictEqual(message.data, data);
        });
    });

    describe(".newEventMessage", () => {
        it("should create a new event message with the given tag and data", () => {
            const tag = "test";
            const data = { message: "Hello, world!" };
            const message = Message.newEventMessage(tag, data);

            assert.strictEqual(message.type, "event");
            assert.strictEqual(message.tag, tag);
            assert.deepStrictEqual(message.data, data);
        });
    });
});
