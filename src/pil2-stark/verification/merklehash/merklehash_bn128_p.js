const LinearHash = require("./linearhash/linearhash.bn128");
const { buildPoseidon } = require("circomlibjs");

module.exports = async function buildMerkleHash(arity, custom) {
    const wasmModule = await getWasmModule();
    const poseidon = await buildPoseidon();
    const MH = new MerkleHash(poseidon, wasmModule, arity, custom);
    return MH;
}

class MerkleHash {

    constructor(poseidon, arity, custom) {
        this.poseidon = poseidon;
        this.F = poseidon.F;
        this.lh = new LinearHash(poseidon, arity, custom);
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

   
}




