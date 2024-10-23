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
                { filename: `./test1/executor2.js`, settings: {} },
            ],
        };

        const airout = createFakeAirout([[0]]);

        await runTest(settings, airout);
    });

    it("thread are blocked until some payload is resolved", async () => {
        const settings = {
            name: "wcManager-test-2-" + Date.now(),
            witnessCalculators: [
                { filename: `./test2/executor1.js`, settings: {} },
                { filename: `./test2/executor2.js`, settings: {} },
            ],
        };

        const airout = createFakeAirout([[0]]);

        await runTest(settings, airout);
    });

    it("deferred payloads are solved", async () => {
        const settings = {
            name: "wcManager-test-3-" + Date.now(),
            witnessCalculators: [
                { filename: `./test3/executor1.js`, settings: {} },
                { filename: `./test3/executor2.js`, settings: {} },
                {
                    filename: `../../src/lib/witness_calculators/div_lib.js`,
                    settings: {},
                },
            ],
        };

        const airout = createFakeAirout([[0]]);

        await runTest(settings, airout);
    });

    it("throws an error when payloads cannot be solved", async () => {
        const settings = {
            name: "wcManager-test-4-" + Date.now(),
            witnessCalculators: [
                { filename: `./test4/executor1.js`, settings: {} },
                { filename: `./test4/executor2.js`, settings: {} },
            ],
        };

        const airout = createFakeAirout([[0]]);

        await runTest(settings, airout).catch((err) => {
            expect(err.message).to.equal(
                "The executing processes do not respond, processes are stucked."
            );
        });
    });

    async function runTest(settings, airout) {
        const wcManager = new WitnessCalculatorManager();

        for (const witnessCalculator of settings.witnessCalculators) {
            const witnessCalculatorLib = path.join(
                __dirname,
                witnessCalculator.filename
            );

            if (!(await fileExists(witnessCalculatorLib))) {
                log.error(
                    `[${this.name}]`,
                    `WitnessCalculator ${witnessCalculator.filename} does not exist.`
                );
                return false;
            }
            witnessCalculator.witnessCalculatorLib = witnessCalculatorLib;
        }

        await wcManager.initialize(settings.witnessCalculators, {});

        wcManager.proofCtx = airout;

        return await wcManager.witnessComputation(1);
    }

    function createFakeAirout(airgroups) {
        const fakeAirgroups = [];

        for (let i = 0; i < airgroups.length; i++) {
            fakeAirgroups[i] = {};
            fakeAirgroups[i].airgroupId = i;
        }

        return { airout: { airgroups: fakeAirgroups } };
    }
});
