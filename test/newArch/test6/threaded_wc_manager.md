# Threaded Witness Computation Manager

The Threaded Witness Computation Manager manages the computation of witnesses in a multi-threaded executors/witness computers environment.

When developing a multi-threaded executor, the developer must extend BaseModule and implement at least the witnessComputation method. The witnessComputation method is the entry point for the witness computation and recevies the parameter `stageId` which is the id of the stage that the witness computation is being requested. The threaded witness computation manager uses a pub/sub mechanism to communicate with the executors. By default all the executors are subscribed to the topic `general`. The developer can override the `onPublishedMessage` method to handle the messages published on any of the channels the executor is subscribed to. The reserved channel names are `general`, `listeners`. The channel `listener` is explained in the next section. 

```
class Executor1 extends BaseModule {
  constructor() {
    super("Executor1");
  }

  async witnessComputation(stageId) {
  }

  async onPublishedMessage(msg) {
  }
}
```

The WCMnager requires a setup for running the executors. The setup is an array of objects with the following structure:
* name: string. Name of the executor
* filename: string. Path to the executor file
* settings: object. Optional. Configuration object for the executor
    * kind: string. Optional. The unique value allowed is `listener`. Any listener will be subscribed by default to the channels `general` and `listeners`. For more information about listeners see the next section.
    * channels: [string]. Optional. The channels the executor is subscribed to. `general`and `listeners` are reserved channels and cannot be used. In our a pub/sub mechanism the subscriber must be subscribed to the channel to receive messages. Any executor can publish messages to any channel.

This is an example of how write a setup:

```
const setup = [
    {
    name: "Executor1",
    filename: `./executor1.js`,
    settings: {},
    },
    {
    name: "Logup",
    filename: `./logup.js`,
    settings: { kind: "listener", channels: ["logup"] },
    },
];
```

In the previous example `Executor1` is subscribed to te channel `general` and `Lopup` is subscribed to the channels `general`, `listeners` and `logup`.

## Pause and Resume the execution of an executor to wait another executor to resolve a witness.

When computing a witness concurrently it is possible that an executor needs to wait for another executor to resolve a witness. The Threaded Witness Computation Manager provides a mechanism to pause and resume the execution of an executor until a certain condition fullfills.

```
const BaseModule = require("./base_module.js");

class Executor1 extends BaseModule {
  constructor() {
    super("Executor1");
    this.ready = false;
  }

  async witnessComputation(stageId) {
    await this.wait_until(() => this.ready == true);
  }

  async onPublishedMessage(msg) {
    this.ready = msg.payload === "witness A computed";
  }
}
```

In the previous example, the executor `Executor1` will pause the execution of the witness computation until the message `witness A computed` is published. The `wait_until` method receives a function that returns a boolean. The executor will pause the execution until the function returns true. The function is evaluated after a message is received by the executor. The executor will resume the execution when the function returns true.


## Listeners Executors

Some executors listen to messages published by other executors to do their computations until all the others executors have finished their computations. These executors are called listeners and must be inidicated in the setup using the property `kind` . A listener is subscribed by default to the channels `general` and `listeners`. The listener can be subscribed to other channels as well using the property `channels` of the setup. Once all non-listeners executors have finished their computations, the listeners will be notified with the message `terminate`.

```
const BaseModule = require("./base_module.js");

class Logup extends BaseModule {
  constructor() {
    super("Logup");
    this.terminate = false;
  }

  async witnessComputation(stageId) {
    await this.wait_until(() => this.terminate == true);
  }

  async onPublishedMessage(msg) {
    if (msg.channel === "logup") {
      // ... the listener can handle messages published on the channel logup, for example "assumes" or "proves" in this case.
    } else {
      this.terminate = this.terminate || msg.payload.command === "terminate";
    }
  }
}

new Logup();
```