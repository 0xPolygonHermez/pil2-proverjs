const log = require('../logger.js');

module.exports = class TaskTable {
    constructor() {
        this.tasks = [];
        this.taskId = 0;
    }

    addTask(task) {
        this.tasks.push({ taskId: this.taskId++, isPending: true, ...task, timestamp: Date.now() });
    }

    resolveTask(taskId) {
        const task = this.tasks.find(task => task.taskId === taskId);
        if (!task) {
            log.error(`Task ${taskId} not found`);
            throw new Error(`Task ${taskId} not found`);
        }

        if(!task.isPending) {
            log.error(`Task ${taskId} already solved`);
            throw new Error(`Task ${taskId} already solved`);
        }

        task.isPending = false;
    }

    getPendingTasks() {
        return this.tasks.filter((task) => task.isPending);
    }

    hasPendingTasks() {
        return this.tasks.some((task) => task.isPending);
    }

    getPendingTasksByRecipient(recipient) {
        return this.tasks.filter((task) => task.isPending && recipient === task.recipient);
    }

    getPendingTasksByTag(tag) {
        return this.tasks.filter((task) => task.isPending && task.tag === tag);
    }

    getPendingTasksByTagDataId(tag, dataId) {
        return this.tasks.filter((task) => task.isPending && task.tag === tag && task.data.dataId === dataId);
    }
}
