const ProofManager = require("./src/proof_manager.js");
const log = require("./logger.js");

async function run(settings) {
    const proofManager = new ProofManager();
    proofManager.initialize("zkEvmProofManager", settings.options);

    const proof = await proofManager.prove(settings.settings, settings.options);
    log.info("Proof generated");
}

proofSettings = {
    settings: {
        name: "zkEvmProof-" + Date.now(),
        pilout: {
            piloutFilename: "./test/simple/simple1/simple1.pilout",
            piloutProto: "../pilcom/src/pilout.proto",
        },
        witnessCalculators: [
            // First witness calculator is the main executor
            { filename: "./test/simple/simple1/simple1_executor.js", type: "main", settings: {parallelExec: false, useThreads: false} },
            { filename: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {},},
        ],
        prover: {
            filename: "./src/lib/provers/stark_prover.js",
            settings: { starkStruct: "./test/simple/simple1/simple1_stark_struct.json", parallelExec: false, useThreads: false },
        },
        checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
        setup: "setup",
    },
    options: {
        debug: true,
        verify: true
    },
};

// proofSettings = {
//     settings: {
//         name: "zkEvmProof-" + Date.now(),
//         pilout: { piloutFilename: "./test/fibonacci_vadcop/fibonacci_vadcop.pilout", piloutProto: "../pilcom/src/pilout.proto" },
//         witnessCalculators: [
//             { file: "./test/fibonacci_vadcop/executor_fibonacci_vadcop.js", settings: {} },
//             { file: "./src/lib/witness_calculators/witness_calculator_lib.js", settings: {} },
//         ],
//         prover: { filename: "./src/lib/provers/stark_prover.js", settings: {} },
//         checker: { filename: "./src/lib/checkers/stark_checker.js", settings: {} },
//         setup: "setup",
//     },
//     options: {
//         debug: true,
//     },
// };

// run(proofSettings).then(
//     () => {
//         process.exit(0);
//     },
//     (err) => {
//         console.log(err.message);
//         console.log(err.stack);
//         process.exit(1);
//     }
// );

function mergeOrderedArrays(arr1, arr2) {
    const isAscending = arr1[0] < arr1[arr1.length - 1];
    const result = [];
  
    while (arr1.length > 0 && arr2.length > 0) {
      if ((isAscending && arr1[0] <= arr2[0]) || (!isAscending && arr1[0] >= arr2[0])) {
        result.push(arr1.shift());
      } else {
        result.push(arr2.shift());
      }
    }
  
    // If there are any remaining elements in arr1 or arr2, add them to the result.
    while (arr1.length > 0) {
      result.push(arr1.shift());
    }
    while (arr2.length > 0) {
      result.push(arr2.shift());
    }
  
    return result;
  }
  
  // Example usage:
  const arr1 = [25, 24, 20, 16, 12];
  const arr2 = [19, 16, 12];
  const mergedArray = mergeOrderedArrays(arr1, arr2);
  
  console.log(mergedArray); // Output will be [25, 24, 20, 19, 16, 16, 12, 12]