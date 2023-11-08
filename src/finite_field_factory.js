const F3g = require("pil2-stark-js/src/helpers/f3g");

const { getRoots } = require("pilcom2/src/utils.js");

class FiniteFieldFactory {
    static createFiniteField(baseField) {
        if (baseField.equals(Buffer.from("FFFFFFFF00000001", "hex"))) {
            let F = new F3g("0xFFFFFFFF00000001");
            F.w = getRoots(F);

            return F;
        } else {
            throw new Error(`Finite field with this characteristic prime number ${"0x" + baseField.toString("hex").toUpperCase()} not supported`);
        }
    }
}

module.exports = FiniteFieldFactory;
