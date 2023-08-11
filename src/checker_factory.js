class CheckerFactory {
    static async createChecker(checkerLib, proofmanagerAPI) {
        const { default: myClass } = await import(checkerLib);
        return new myClass(proofmanagerAPI);
    }
}

module.exports = CheckerFactory;