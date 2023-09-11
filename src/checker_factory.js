class CheckerFactory {
    static async createChecker(filename, proofmanagerAPI) {
        const { default: myClass } = await import(filename);
        return new myClass(proofmanagerAPI);
    }
}

module.exports = CheckerFactory;