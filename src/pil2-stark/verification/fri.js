const F3g = require("../utils/f3g");

class FRI {

    constructor(nQueries, stepsFRI, MH, logger) {
        this.F = new F3g();
        this.steps = stepsFRI;
        this.nQueries = nQueries;
        let blowupFactor = Math.ceil(128 / nQueries); 
        this.maxDegNBits = this.steps[0].nBits - blowupFactor;
        this.logger = logger
        this.MH = MH;
    }

    verifyMH(friQueries, proof) {
        for (let si = 1; si < this.steps.length; si++) {
            if(this.logger) this.logger.debug("Verifying MH FRI step: " + this.steps[si].nBits);
            const root = proof[si - 1].root;
            for (let i=0; i<this.nQueries; i++) {
                let queryIdx = friQueries[i] % (1 << this.steps[si].nBits);
                const query = proof[si - 1].polQueries[i];
                const res = this.MH.verifyGroupProof(root, query[1], queryIdx, query[0]);
                if (!res) return false;
            }
        }
        return true;
    }

    verifyStepFRI(step, friQueries, currValues, nextValues) {
        for (let i=0; i<this.nQueries; i++) {
            let queryIdx = friQueries[i] % (1 << this.steps[step].nBits);
            if (step < this.steps.length - 1) {
                const nextNGroups = 1 << this.steps[step+1].nBits;
                const groupIdx = Math.floor(queryIdx / nextNGroups);
                if (!this.F.eq([nextValues[i][groupIdx*3], nextValues[i][groupIdx*3+1], nextValues[i][groupIdx*3+2]], currValues[i])) return false;
            } else {
                if (!this.F.eq(nextValues[queryIdx], currValues[i])) return false;
            }
        }
        return true;
    }

    computeNextStepFRI(si, friChallenges, friQueries, proof) {
        const nextVals = [];
        if(this.logger) {
            this.logger.debug("Verifying FRI construction from " + this.steps[si - 1].nBits + " to " + this.steps[si].nBits);
        }
        let shift = this.F.shift;
        for (let j=0; j<this.steps[0].nBits - this.steps[si - 1].nBits; j++) shift = this.F.mul(shift, shift);
        for (let i=0; i<this.nQueries; i++) {
            let queryIdx = friQueries[i] % (1 << this.steps[si].nBits);
            const pgroup_c = this.F.ifft(split3(proof[si - 1].polQueries[i][0]));
            const sinv = this.F.inv(this.F.mul( shift, this.F.exp(this.F.w[this.steps[si - 1].nBits], queryIdx)));
            const ev = evalPol(this.F, pgroup_c, this.F.mul(friChallenges[si], sinv));
            nextVals.push(ev);
        }
        return nextVals;
    }

    verifyFinalPol(pol) {
        this.logger.debug("Verifying FRI final polynomial");
        
        let polBits = this.steps[this.steps.length - 1].nBits;
        let maxDeg;
        if (( polBits - (this.steps[0].nBits - this.maxDegNBits)) <0) {
            maxDeg = 0;
        } else {
            maxDeg = 1 <<  ( polBits - (this.steps[0].nBits - this.maxDegNBits));
        }

        const lastPol_c = this.F.ifft(pol);
        // We don't need to divide by shift as we just need to check for zeros

        for (let i=maxDeg+1; i< lastPol_c.length; i++) {
            if (!this.F.isZero(lastPol_c[i])) return false;
        }

        return true;
    }
}

module.exports = FRI;

function split3(arr) {
    const res = [];
    for (let i=0; i<arr.length; i+=3) {
        res.push([arr[i], arr[i+1], arr[i+2]]);
    }
    return res;
}

function evalPol(F, p, x) {
    if (p.length == 0) return F.zero;
    let res = p[p.length-1];
    for (let i=p.length-2; i>=0; i--) {
        res = F.add(F.mul(res, x), p[i]);
    }
    return res;
}