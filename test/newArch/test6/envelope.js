class Envelope {
  constructor(sender, recipient, type, payload, channel = undefined) {
    this.sender = sender;
    this.recipient = recipient;
    this.type = type;
    if (channel !== undefined) this.channel = channel;
    this.payload = payload;
  }
}

module.exports = Envelope;
