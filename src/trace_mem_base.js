const TraceMemStoreTypeEnum = {
    RowMajor: 1,
    ColumnMajor: 2,
};

class TraceMemBase {
    constructor(rowBytes, numRows) {
        this.rowBytes = rowBytes;
        this.numRows = numRows;

        this.totalBytes = rowBytes * numRows;
    }
}

module.exports =  { TraceMemBase, TraceMemStoreTypeEnum };