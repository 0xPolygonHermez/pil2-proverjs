const log = require("../logger.js");

const PayloadTypeEnum = {
    NOTIFICATION: "notification",
};

class AirBusPayload {
    constructor(sender, recipient, type, tag, data) {
        this.sender = sender;
        this.recipient = recipient;
        this.type = type;
        this.tag = tag;
        this.data = data;
    }
}

class AirBus {
    constructor() {
        this.payloads = [];
        this.payloadId = 0;
    }

    addBusPayload(payload) {
        this.payloads.push({
            payloadId: this.payloadId++,
            isPending: true,
            ...payload,
            timestamp: Date.now(),
        });
    }

    resolveBusPayload(payloadId) {
        const payload = this.payloads.find((payload) => payload.payloadId === payloadId);
        if (!payload) {
            log.error(`[AirBus]`, `Payload ${payloadId} not found`);
            throw new Error(`Payload ${payloadId} not found`);
        }

        if (!payload.isPending) {
            log.error(`[AirBus]`, `Payload ${payloadId} already solved`);
            throw new Error(`Payload ${payloadId} already solved`);
        }

        payload.isPending = false;
    }

    getPendingPayloads() {
        return this.payloads.filter((payload) => payload.isPending);
    }

    hasPendingPayloads() {
        return this.payloads.some((payload) => payload.isPending);
    }

    getPendingPayloadsByRecipient(recipient) {
        return this.payloads.filter(
            (payload) => payload.isPending && recipient === payload.recipient
        );
    }

    getPendingPayloadsByTag(tag) {
        return this.payloads.filter((payload) => payload.isPending && payload.tag === tag);
    }

    getPendingPayloadsByTagDataId(tag, dataId) {
        return this.payloads.filter(
            (payload) =>
                payload.isPending &&
                payload.tag === tag &&
                payload.data.dataId === dataId
        );
    }
};

module.exports = {
    AirBus,
    AirBusPayload,
    PayloadTypeEnum,
}
