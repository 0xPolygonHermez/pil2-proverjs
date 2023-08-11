// Abstract base class for all Checker components
class CheckerComponent {
    constructor(name, proofmanagerAPI) {
        this.name = name;
        this.proofmanagerAPI = proofmanagerAPI;
    }

    initialize() {
        throw new Error("Method 'initialize' must be implemented in concrete classes.");
    }

    check() {
        throw new Error("Method 'check' must be implemented in concrete classes.");
    }
}

module.exports = CheckerComponent;