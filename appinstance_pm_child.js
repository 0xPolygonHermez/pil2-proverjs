const AppState = require("./appinstance_pm.js");

function child() {
    console.log("Child says:", AppState.dataToPass);
};

module.exports = child;
