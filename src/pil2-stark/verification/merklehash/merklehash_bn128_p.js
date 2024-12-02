const LinearHash = require("./linearhash/linearhash.bn128");
const { buildPoseidon, buildPoseidonWasm } = require("circomlibjs");
const { buildF1m } = require("wasmcurves");
const { ModuleBuilder } = require("wasmbuilder")

module.exports = async function buildMerkleHash(arity, custom) {
    const wasmModule = await getWasmModule();
    const poseidon = await buildPoseidon();
    const MH = new MerkleHash(poseidon, wasmModule, arity, custom);
    return MH;
}

class MerkleHash {

    constructor(poseidon, wasmModule, arity, custom) {
        this.poseidon = poseidon;
        this.F = poseidon.F;
        this.lh = new LinearHash(poseidon, arity, custom);
        this.minOpsPerThread = 1<<12;
        this.maxOpsPerThread = 1<<16;
        this.wasmModule = wasmModule;
        this.useThreads = true;
        this.arity = arity;
        this.custom = custom;
    }

    calculateRootFromGroupProof(mp, idx, vals) {

        const self = this;
        const lh = this.lh;

        const a = [];
        for (let i=0; i<vals.length; i++) {
            if (Array.isArray(a[i])) {
                for (j=0; j<vals[i].length; j++) {
                    a.push(vals[i][j]);
                }
            } else {
                a.push(vals[i]);
            }
        }

        const h = lh.hash(a);

        return this.F.toObject(merkle_calculateRootFromProof(mp, idx, h));

        function merkle_calculateRootFromProof(mp, idx, value, offset) {
            offset = offset || 0;
            if (mp.length == offset) {
                return value;
            }

            const nBitsArity = Math.ceil(Math.log2(self.arity));
            const curIdx = idx & (self.arity - 1);
            const nextIdx = idx >> nBitsArity;

            const buff = new Uint8Array(32*self.arity);
            for (let i=0; i<self.arity; i++) {
                buff.set(self.F.e(mp[offset][i]), i*32);
            }
            buff.set(value, curIdx*32);

            const nextValue = self.poseidon(buff);

            return merkle_calculateRootFromProof(mp, nextIdx, nextValue, offset+1);
        }

    }

    eqRoot(r1, r2) {
        return BigInt(r1) === BigInt(r2);
    }

    verifyGroupProof(root, mp, idx, groupElements) {
        const cRoot = this.calculateRootFromGroupProof(mp, idx, groupElements);
        return this.eqRoot(cRoot, root);
    }

    root(tree) {
        const buff8 = new Uint8Array(tree.nodes.buffer, tree.nodes.byteLength-32, 32);
        return this.F.toObject(buff8);
    }
}

async function getWasmModule() {

    const moduleBuilder = new ModuleBuilder();
    buildF1m(moduleBuilder, "21888242871839275222246405745257275088548364400416034343698204186575808495617", "frm");

    buildPoseidonWasm(moduleBuilder);

    const code = moduleBuilder.build();

    const wasmModule = await WebAssembly.compile(code);

    return wasmModule;
}




