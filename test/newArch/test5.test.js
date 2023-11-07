const WitnessCalculatorManagerNew = require("./wc_manager_new.js");

describe("New WC Manager multithread architecture", async function () {
    this.timeout(10000000);

    it("Test", async () => {
        const modules = [
            { filename: `./test1/executor1.js`, settings: {} },
            // { filename: `./test1/executor2.js`, settings: {} }
        ];

        const obj = new WitnessCalculatorManagerNew();
        await obj.run(modules);
    });
});
