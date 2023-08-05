const Child = require("./appinstance_pm_child.js");

// state.js (Singleton module)
class AppState {
    constructor() {
      if (AppState.instance) {
        return AppState.instance;
      }
  
      this.dataToPass = "Hello from parent!";
      AppState.instance = this;
    }
  }
  
  const stateInstance = new AppState();
  Object.freeze(stateInstance);
  
  module.exports = stateInstance;
  
  // parent.js (Parent module)
  console.log("Parent says:", AppState.dataToPass);
  console.log(Child);
  Child.child();