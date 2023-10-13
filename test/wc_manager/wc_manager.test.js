const { WitnessCalculatorManager } = require("../../src/witness_calculator_manager.js");
const { fileExists } = require("../../src/utils.js");
const log = require("../../logger.js");
const path = require("path");

describe("Witnes Computation Manager tests", async function () {
    this.timeout(10000000);

    it("B resolves a pending task without locked thread", async () => {
        const settings = {
            name: "wcManager-test-1-" + Date.now(),
            witnessCalculators: [
                { filename: `./test1/executor1.js`, settings: {} },
                { filename: `./test1/executor2.js`, settings: {} }],
        };

        const subproofsCtx = createFakeSubproofsCtx([[1]]);

        await runTest(settings, subproofsCtx);
    });

    it("B resolves a pending task and unlock A thread", async () => {
        const settings = {
            name: "wcManager-test-2-" + Date.now(),
            witnessCalculators: [
                { filename: `./test2/executor1.js`, settings: {} },
                { filename: `./test2/executor2.js`, settings: {} }]
        };

        const subproofsCtx = createFakeSubproofsCtx([[1]]);

        await runTest(settings, subproofsCtx);
    });

    it("A and B locks and C unlock in batch mode", async () => {
        const settings = {
            name: "wcManager-test-3-" + Date.now(),
            witnessCalculators: [
                { filename: `./test3/executor1.js`, settings: {} },
                { filename: `./test3/executor2.js`, settings: {} },
                { filename: `./test3/executor3.js`, settings: { type: "unlocker"} } ]
        };

        const subproofsCtx = createFakeSubproofsCtx([[1]]);

        await runTest(settings, subproofsCtx);
    });

    async function runTest(settings,subproofsCtx) {
        const wcManager = new WitnessCalculatorManager();

        for(const witnessCalculator of settings.witnessCalculators) {
            const witnessCalculatorLib =  path.join(__dirname, witnessCalculator.filename);

            if (!await fileExists(witnessCalculatorLib)) {
                log.error(`[${this.name}]`, `WitnessCalculator ${witnessCalculator.filename} does not exist.`);
                return false;
            }
            witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
        }

        await wcManager.initialize(settings.witnessCalculators, {});

        wcManager.subproofsCtx = subproofsCtx;

        await wcManager.witnessComputationX(1);
    }

    function createFakeSubproofsCtx(subproofs) {

        const subproofsCtx = [];

        for(let i=0; i< subproofs.length; i++) {
            subproofsCtx[i] = {};
            subproofsCtx[i].airsCtx = createFakeAirCtx(subproofs[i]);
        }

        return subproofsCtx;
    }

    function createFakeAirCtx(airs) {
        const airCtx = [];

        for(let i=0; i< airs.length; i++) {
            airCtx[i] = [];
            airCtx[i].instances = []; // = createFakeAirInstanceCtx(airs[i]);
        }

        return airCtx;
    }
});