describe("New WC Manager multithread architecture", async function () {
    this.timeout(10000000);

    it("Test", async () => {
        const WCManager = require("./test4/wc_manager.js");

        const wcManager = new WCManager();
        
        await wcManager.run([
            { name: "Executor1", filename: `./test/newArch/test4/executor1.js`, settings: {} },
            { name: "Executor3", filename: `./test/newArch/test4/executor3.js`, settings: {} },
            { name: "Executor4", filename: `./test/newArch/test4/executor4.js`, settings: {} },
            { name: "Executor2", filename: `./test/newArch/test4/executor2.js`, settings: { type: "listener" } },
        ]);
    });
});
