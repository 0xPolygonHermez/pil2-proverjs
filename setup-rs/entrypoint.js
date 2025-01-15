console.log("Starting main setup process...");

// Simulate `process.argv` for standard args
globalThis.process = {
  argv: [
    "node", "main_setup.js", // Simulated Node.js executable and script name
    "-a", "airout.ptb",
    "-s", "starkstructs.json",
    "-b", "tmp",
    "-t", "consttree_path",
    "-f", "binfile_path",
    "-r", "true",
    "-m", "true",
    "-l", "stdlib_path",
  ],
};

// Correctly reference `main_setup.js` relative to the baked-in `src` directory
require("./main_setup");
