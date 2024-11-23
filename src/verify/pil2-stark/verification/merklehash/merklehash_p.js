const LinearHash = require("./linearhash/linearhash.js");
const LinearHashGPU = require("./linearhash/linearhash_gpu.js");

buildPoseidon = require("../poseidon/poseidon.js");

module.exports = async function buildMerkleHash(splitLinearHash = false) {
    const poseidon = await buildPoseidon();
    const MH = new MerkleHash(poseidon, splitLinearHash);
    return MH;
}

class MerkleHash {

    constructor(poseidon, splitLinearHash = false) {
        this.poseidon = poseidon;
        this.F = poseidon.F;
        this.splitLinearHash = splitLinearHash;
        this.lh = splitLinearHash ? new LinearHashGPU(poseidon) : new LinearHash(poseidon);
        this.useThreads = true;
    }

    calculateRootFromGroupProof(mp, idx, vals) {

        const poseidon = this.poseidon;
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

        return merkle_calculateRootFromProof(mp, idx, h)

        function merkle_calculateRootFromProof(mp, idx, value, offset) {
            offset = offset || 0;
            if (mp.length == offset) {
                return value;
            }

            const curIdx = idx & 1;
            const nextIdx = Math.floor(idx / 2);

            let nextValue;
            if (curIdx == 0) {
                nextValue = poseidon([...value, ...mp[offset]])
            } else {
                nextValue = poseidon([ ...mp[offset], ...value])
            }

            return merkle_calculateRootFromProof(mp, nextIdx, nextValue, offset+1);
        }

    }

    eqRoot(r1, r2) {
        const poseidon = this.poseidon;
        for (let k=0; k<4; k++) {
            if (!poseidon.F.eq(r1[k], r2[k])) return false;
        }
        return true;
    }

    verifyGroupProof(root, mp, idx, groupElements) {
        const cRoot = this.calculateRootFromGroupProof(mp, idx, groupElements);
        return this.eqRoot(cRoot, root);
    }
}


