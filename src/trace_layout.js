class TraceColumnsLayout {
    constructor(traceColumns, numRows) {
        this.traceColumns = [];
        this.numRows = numRows;
        
        this.rowBytes = 0;

        traceColumns.forEach(traceColumn => {
            this.addTraceColumn(traceColumn);
        });
    }

    addTraceColumn(traceColumn) {
        traceColumn.posBytes = this.rowBytes;

        this.traceColumns.push(traceColumn);
        this.rowBytes += traceColumn.columnBytes;
    }

    get numCols() {
        return this.traceColumns.length;
    }

    findColumnByName(columnName) {
        const columnIdx = this.findColumnIdxByName(columnName);
        return this.traceColumns[columnIdx];
    }

    findColumnIdxByName(columnName) {
        return this.traceColumns.findIndex(column => column.columnName === columnName);
    }

    existsColumn(columnName) {
        return -1 !== this.columns.findIndex(column => column.columnName === columnName);
    }

};

module.exports = TraceColumnsLayout;