const WitnessCalculatorManager = require("../../src/witness_calculator_manager.js");
const { fileExists } = require("../../src/utils.js");
const log = require("../../logger.js");
const path = require("path");
const { expect } = require("chai");

describe("Witnes Computation Manager tests", async function () {
    this.timeout(10000000);

    it("adds payload without blocking", async () => {
        const settings = {
            name: "wcManager-test-1-" + Date.now(),
            witnessCalculators: [
                { filename: `./test1/executor1.js`, settings: {} },
                { filename: `./test1/executor2.js`, settings: {} }],
        };

        const subproofsCtx = createFakeSubproofsCtx([[0]]);

        await runTest(settings, subproofsCtx);
    });

    it("thread are blocked until some payload is resolved", async () => {
        const settings = {
            name: "wcManager-test-2-" + Date.now(),
            witnessCalculators: [
                { filename: `./test2/executor1.js`, settings: {} },
                { filename: `./test2/executor2.js`, settings: {} }]
        };

        const subproofsCtx = createFakeSubproofsCtx([[0]]);

        await runTest(settings, subproofsCtx);
    });

    it("deferred payloads are solved", async () => {
        const settings = {
            name: "wcManager-test-3-" + Date.now(),
            witnessCalculators: [
                { filename: `./test3/executor1.js`, settings: {} },
                { filename: `./test3/executor2.js`, settings: {} },
                { filename: `../../src/lib/witness_calculators/div_montgomery_batch_lib.js`, settings: {} } ]
        };

        const subproofsCtx = createFakeSubproofsCtx([[0]]);

        await runTest(settings, subproofsCtx);
    });

    it("throws an error when payloads cannot be solved", async () => {
        const settings = {
            name: "wcManager-test-4-" + Date.now(),
            witnessCalculators: [
                { filename: `./test4/executor1.js`, settings: {} },
                { filename: `./test4/executor2.js`, settings: {} }]
        };

        const subproofsCtx = createFakeSubproofsCtx([[0]]);

        await runTest(settings, subproofsCtx).catch(err => {
            expect(err.message).to.equal("The executing processes do not respond, processes are stucked.");
        });
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

        wcManager.proofCtx = { subproofsCtx };

        return await wcManager.witnessComputation(1);
    }

    function createFakeSubproofsCtx(subproofs) {

        const subproofsCtx = [];

        for(let i=0; i< subproofs.length; i++) {
            subproofsCtx[i] = {};
            subproofsCtx[i].subproofId = i;
            subproofsCtx[i].airsCtx = createFakeAirCtx(subproofs[i], i);
        }

        return subproofsCtx;
    }

    function createFakeAirCtx(airs, subproofId) {
        const airCtx = [];

        for(let i=0; i< airs.length; i++) {
            airCtx[i] = [];
            airCtx[i].airId = i;
            airCtx[i].subproofCtx = { subproofId };
            airCtx[i].instances = new Array(airs[i]);
            for(let j=0; j< airs[i]; j++) {
                airCtx[i].instances[j] = {
                    instanceId: j,
                };
            }
        }

        return airCtx;
    }
});