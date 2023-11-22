const { TraceMemFactory } = require('./trace_mem_factory');

const log = require('../logger');

class Trace {
    constructor(traceLayout, traceStoreType, traceMemStreamType) {
        this.traceLayout = traceLayout;
        this.traceStoreType = traceStoreType;
        this.traceMemStreamType = traceMemStreamType;

        this.traceMemStream = TraceMemFactory.createTraceMemStream(traceLayout, traceStoreType, traceMemStreamType);
    }

    print() {
        log.info("TraceLayout", "Trace Layout Info");
        log.info("TraceLayout", "    Columns: ", this.traceLayout.numCols);
        log.info("TraceLayout", "    Rows: ", this.traceLayout.numRows);
        log.info("TraceLayout", "    Trace Store Type: ", this.traceStoreType);
        log.info("TraceLayout", "    Trace Mem   Type: ", this.traceMemStreamType);
        log.info("TraceLayout", "    Bytes per Row: ", this.traceLayout.rowBytes);
        this.traceMemStream.print();
    }
}

module.exports = { Trace };