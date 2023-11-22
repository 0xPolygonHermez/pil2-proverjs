const { Trace } = require("../../src/trace.js");
const TraceColumn = require("../../src/trace_column.js");
const TraceLayout = require("../../src/trace_layout.js");
const { TraceMemTypeEnum } = require("../../src/trace_mem_factory.js");
const { TraceMemStoreTypeEnum } = require("../../src/trace_mem_base.js");

describe("Trace tests", async function () {
    this.timeout(10000000);

    describe("Trace test", async function () {
        const traceLayout = new TraceLayout([
            new TraceColumn("a", 32),
            new TraceColumn("b", 64),
            new TraceColumn("c", 32),
        ], 2**4);

        const trace = new Trace(
            traceLayout,
            TraceMemStoreTypeEnum.RowMajor,
            TraceMemTypeEnum.SharedMemory,
        );

        trace.print();
    });
});
