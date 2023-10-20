
const TaskTypeEnum = {
    NOTIFICATION: "notification",
};

class Task {
    constructor(sender, recipient, type, tag, data) {
        this.sender = sender;
        this.recipient = recipient;
        this.type = type;
        this.tag = tag;
        this.data = data;
    }
}

module.exports = {
    Task,
    TaskTypeEnum,
}
