const fs = require("fs");
const BigBuffer = require("./big_buffer");

function generateMultiArrayIndexes(symbols, name, lengths, polId, stage, indexes = []) {
    if (indexes.length === lengths.length) {
        symbols.push({ name, lengths: indexes, id: polId, stage, });
        return polId + 1;
    }

    for (let i = 0; i < lengths[indexes.length]; i++) {
        polId = generateMultiArrayIndexes(symbols, name, lengths, polId, stage, [...indexes, i]);
    }

    return polId; 
}

function setValueMultiArray(arr, indexes, value) {
    if (indexes.length === 1) {
        arr[indexes[0]] = value;
    } else {
        const nextIndex = indexes[0];
        if (!Array.isArray(arr[nextIndex])) arr[nextIndex] = [];
        setValueMultiArray(arr[nextIndex], indexes.slice(1), value);
    } 
}
    
module.exports.generateFixedCols = function generateFixedCols(symbols, degree, pil2 = true) {
    const fixedSymbols = [];
    const nSymbols = pil2 ? symbols.length : Object.keys(symbols).length;
    for (let i = 0; i < nSymbols; ++i) {
        const symbol = pil2 ? symbols[i] : symbols[Object.keys(symbols)[i]];
        const name = pil2 ? symbol.name : Object.keys(symbols)[i];
        const stage = symbol.stage;
        const id = symbol.id;
        const lengths = pil2 ? (symbol.lengths || []) : symbol.isArray ? [ symbol.len ] : [];
        if((pil2 && (stage !== 0 || symbol.type !== 1)) || (!pil2 && symbol.type !== "constP")) continue;
        if(!lengths.length) {
            fixedSymbols.push({name, id, stage, lengths});
        } else {
            generateMultiArrayIndexes(fixedSymbols, name, lengths, id, stage);
        }
    }
    
    const fixedCols = new ColsPil2(fixedSymbols, degree);
    return fixedCols;
}

class ColsPil2 {
    constructor(symbols, degree) {
        this.$$def = {};
        this.$$defArray = [];

        this.$$n = degree;
        this.$$nCols = symbols.length;
        this.$$buffer = [];
                    
        this.$$buffer = new BigBuffer(this.$$nCols*this.$$n);

        this.symbols = symbols;
        for(let i = 0; i < symbols.length; ++i) {
            const symbol = symbols[i];
            const name = symbol.name;
            const [nameSpace, namePol] = name.split(".");
            if (!this[nameSpace]) this[nameSpace] = {};
            if (!this.$$def[nameSpace]) this.$$def[nameSpace] = {};
            
            const polProxy = this.createArrayProxy(symbol.id);

            this.$$defArray[symbol.id] = {
            name: name,
            id: symbol.id,
            stage: symbol.stage,
            polDeg: degree,
            lengths: symbol.lengths
            };

            if (symbol.lengths.length > 0) {
                if (!this[nameSpace][namePol]) this[nameSpace][namePol] = [];
                if (!this.$$def[nameSpace][namePol]) this.$$def[nameSpace][namePol] = [];
                setValueMultiArray(this[nameSpace][namePol], symbol.lengths, polProxy);
                setValueMultiArray(this.$$def[nameSpace][namePol], symbol.lengths, this.$$defArray[symbol.id]);
            } else {
                this[nameSpace][namePol] = polProxy;
                this.$$def[nameSpace][namePol] = this.$$defArray[symbol.id];
            }
            this[symbol.id] = polProxy;
        }
    }

    createArrayProxy(symbolId) {
          
        const nCols = this.$$nCols;
        const buff = this.$$buffer;
        const N = this.$$n;

        return new Proxy([], {
            set(target, prop, value) {
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                
                if(value < 0n) value += 0xFFFFFFFF00000001n;

                buff.setElement(buffIndex,value);
                
                target[pos] = value; // This adds the value to the array itself
                
                return true;
            },

            get(target, prop) {
                if (prop === 'length') {
                    return N; // Return the degree for 'length' property
                }
                const pos = parseInt(prop, 10);
                const buffIndex = nCols * pos + symbolId;
                return buff.getElement(buffIndex);
            }
        });
    }

    async saveToFile(fileName) {
        const fd =await fs.promises.open(fileName, "w+");

        const MaxBuffSize = 1024*1024*32;  //  256Mb
        const totalSize = this.$$nCols*this.$$n;
        const buff = new BigUint64Array(Math.min(totalSize, MaxBuffSize));

        let p=0;
        for (let i=0; i<totalSize; i++) {
            buff[p++] = (this.$$buffer.getElement(i) < 0n) ? (this.$$buffer.getElement(i) + 0xffffffff00000001n) : this.$$buffer.getElement(i);
            if (p == buff.length) {
                const buff8 = new Uint8Array(buff.buffer);
                await fd.write(buff8);
                p=0;
            }
            
        }

        if (p) {
            const buff8 = new Uint8Array(buff.buffer, 0, p*8);
            await fd.write(buff8);
        }

        await fd.close();
    }
}



