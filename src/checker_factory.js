class CheckerFactory {
    static async createChecker(filename) {
        const { default: myClass } = await import(filename);
        return new myClass();
    }
}

module.exports = CheckerFactory;