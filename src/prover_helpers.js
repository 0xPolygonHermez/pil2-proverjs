
const proverHelpers = require("pil2-stark-js/src/prover/prover_helpers.js");
const hintHelpers = require("pil2-stark-js/src/prover/hints_helpers.js");

module.exports.setPol = function setPol(ctx, idPol, pol, dom, options) {
    return proverHelpers.setPol(ctx, idPol, pol, dom, options);
}

module.exports.getPol = function getPol(ctx, idPol, dom, isFixed = false) {
    return proverHelpers.getPol(ctx, idPol, dom, isFixed);
}

module.exports.getFixedPol = function getFixedPol(ctx, idPol) {
    return proverHelpers.getFixedPol(ctx, idPol);
}

module.exports.setAirgroupValue = function setAirgroupValue(ctx, id, value, options) {
    return proverHelpers.setAirgroupValue(ctx, id, value, options);
}

module.exports.getHintField = function getHintField(ctx, hint, field, dest = false, debug = false) {
    return hintHelpers.getHintField(ctx, hint, field, dest, debug);
}