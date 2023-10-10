const assert = require("assert");
const Envelope = require("../../src/messaging/envelope.js");

describe("Envelope", () => {
    describe("#constructor", () => {
        it("should create a new envelope with the given subscriber, recipient, and payload", () => {
            const subscriber = { name: "Alice" };
            const recipient = "Bob";
            const payload = { message: "Hello, world!" };
            const envelope = new Envelope(subscriber, recipient, payload);

            assert.strictEqual(envelope.sender, subscriber.name);
            assert.strictEqual(envelope.recipient, recipient);
            assert.deepStrictEqual(envelope.payload, payload);
        });
    });
});
