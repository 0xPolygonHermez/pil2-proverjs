describe("New WC Manager multithread architecture", async function () {
  this.timeout(10000000);

  it("Test", async () => {
    const { WCManager } = require("./wc_manager.js");

    const wcManager = new WCManager();

    await wcManager.run([
      {
        name: "Main",
        filename: `./main_sm.js`,
        settings: {},
      },
      {
        name: "Executor1",
        filename: `./executor1.js`,
        settings: {},
      },
      {
        name: "Executor2",
        filename: `./executor2.js`,
        settings: {},
      },
      {
        name: "Listener",
        filename: `./listener.js`,
        settings: { kind: "listener", channels: ["listener"] },
      },
    ]);
  });
});
