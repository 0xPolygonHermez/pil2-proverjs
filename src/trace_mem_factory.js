const TraceMemBlock = require('./trace_mem_block');

const TraceMemTypeEnum = {
    SharedMemory: 1,
};

class TraceMemFactory {
    static createTraceMemStream(traceLayout, traceStoreType, memType) {
        switch(memType) {
            case TraceMemTypeEnum.SharedMemory:
                return new TraceMemBlock(traceLayout, traceStoreType);
            default:
                throw new Error("Unknown TraceMemStreamTypeEnum");
        }
    }
}

module.exports = {
    TraceMemFactory,
    TraceMemTypeEnum,
};
