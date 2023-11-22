const { TraceMemBase, TraceMemStoreTypeEnum } = require("./trace_mem_base.js")

const log = require("../logger.js");
class TraceMemBlock extends TraceMemBase {
    constructor(traceLayout, traceStoreType) {
        super(traceLayout.rowBytes, traceLayout.nRows);

        this.traceTable = [];

        this.memStream = new SharedArrayBuffer(this.totalBytes);

        let offset = 0;
        traceLayout.traceColumns.forEach((column) => {
            const traceTableItem = {
                columnName: column.columnName,
                ptr: offset,
                offset:
                    traceStoreType === TraceMemStoreTypeEnum.RowMajor
                        ? traceLayout.rowBytes
                        : column.columnBytes,
            };

            this.traceTable.push(traceTableItem);

            offset += column.columnBytes;
        });

    }

    print() {
        this.traceTable.forEach(column => {
            log.info("TraceLayout", `    · ${column.columnName}: ${column.ptr} [+${column.offset}] bytes`);
        });
    }
}

module.exports = TraceMemBlock;