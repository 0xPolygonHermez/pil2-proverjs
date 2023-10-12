const { WitnessCalculatorManager } = require("../../../src/witness_calculator_manager.js");
const { fileExists } = require("../../../src/utils.js");
const log = require("../../../logger.js");
const path = require("path");

describe("Witness Computation Manager flow test 2", async function () {
    this.timeout(10000000);

    it("Witness Computation Manager flow test 1", async () => {
        const settings = {
            name: "wcManager-test-2-" + Date.now(),
            witnessCalculators: [
                { filename: `executor1.js`, settings: {} },
                { filename: `executor2.js`, settings: {} }]
        };

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

        let subproofsCtx = createFakeSubproofsCtx([[1]]);
        wcManager.subproofsCtx = subproofsCtx;

        await wcManager.witnessComputationX(1);

        return;

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
});