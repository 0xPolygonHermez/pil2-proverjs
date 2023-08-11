// const ProofManager = require("./proof_manager.js");
// const log = require("../logger.js");

// class ProofManager {
//     constructor() {
//         log.info("[ProofManager]", "New instance created.");
//     }

//     async execute(provingFlow, options) {
//         // TODO this json is alive while developing, at this moment a sequence of proofs
//         // is the valid input. We have to introduce a way to connect the proofs
//         // and to define which kind of proof is it. It will allows us to manage software proofs connected
//         // to circuit checkers.
//         /*
//          * provingFlow is a JSON object containing the following fields:
//          * - proofs: array of provingSchema 
//          */
//         if (!await provingFlowIsValid(provingFlow)) {

//             log.error("[ProofManager]", "Invalid provingFlow.");
//             throw new Error("Invalid provingFlow.");
//         }

//         // TODO refactorize when we have a valid provingFlow
//         const proofManager = new ProofManager();
//         try {
//             for(const provingSchema of provingFlow.proofs) {
//                 proofManager.initialize("ProofManager", options);

//                 const proof = await proofManager.prove(provingSchema, options);
//                 log.info("[ProofManager]", `Proof ${provingSchema.name} generated`);
//             }        
//         } catch (error) {
//             log.error("[ProofManager]", `Error while executing: ${error}`);
//             throw error;
//         } finally {
//         }

//         return true;

//         async function provingFlowIsValid(provingFlow) {
//             const fields = ["proofs"];
//             for (const field of fields) {
//                 if (provingFlow[field] === undefined) {
//                     log.error("[ProofManager]", `No ${field} provided in the provingFlow.`);
//                     return false;
//                 }
//             }

//             return true;
//         }
//     }
// }

// module.exports = ProofManager;
