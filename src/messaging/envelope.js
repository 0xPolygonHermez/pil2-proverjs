
class Envelope {
    constructor(subscriber, recipient, payload) {
        this.sender = subscriber.name;
        this.recipient = recipient;
        this.payload = payload;
        this.timestamp = Date.now();
    }
}

module.exports = Envelope;