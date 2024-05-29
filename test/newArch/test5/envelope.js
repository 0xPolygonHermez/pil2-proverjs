
class Envelope {
    constructor(sender, recipient, payload) {
        this.sender = sender;
        this.recipient = recipient;
        this.payload = payload;
        this.timestamp = Date.now();
    }
}

module.exports = Envelope;