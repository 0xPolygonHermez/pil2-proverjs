module.exports.writeType = function writeType(type, c_args, parserType, global = false) {
    if(global && !["public", "number", "airgroupvalue", "tmp1", "tmp3", "proofvalue", "challenge"].includes(type)) {
        throw new Error("Global constraints only allow for publics, numbers, airgroupvalues and proofvalues");
    }
    switch (type) {
        case "public":
            return parserType === "pack" 
                ? `&publics[args[i_args + ${c_args}] * nrowsPack]`
                : `publics[args[i_args + ${c_args}]]`;
        case "proofvalue":
            return parserType === "pack" 
                ? `&proofValues[args[i_args + ${c_args}] * nrowsPack * FIELD_EXTENSION]`
                : `proofValues[args[i_args + ${c_args}]]`;
        case "tmp1":
            return parserType === "pack" 
                ? `&tmp1[args[i_args + ${c_args}] * nrowsPack]`
                : `tmp1[args[i_args + ${c_args}]]`; 
        case "tmp3":
            return parserType === "pack" 
                ? `&tmp3[args[i_args + ${c_args}] * nrowsPack * FIELD_EXTENSION]`
                : `tmp3[args[i_args + ${c_args}]]`;
        case "commit1":
        case "commit3":
        case "const":
            return parserType === "pack"
                ? `&bufferT_[(nColsStagesAcc[args[i_args + ${c_args}]] + args[i_args + ${c_args + 1}]) * nrowsPack]`
                : `${type === "commit3" ? `(${parserType === "avx" ? "Goldilocks3::Element_avx" : "Goldilocks3::Element_avx512"} &)` : ""}bufferT_[nColsStagesAcc[args[i_args + ${c_args}]] + args[i_args + ${c_args + 1}]]`;
        case "challenge":
            return parserType === "pack"
                ? `&challenges[args[i_args + ${c_args}]*FIELD_EXTENSION*nrowsPack]`
                : `challenges[args[i_args + ${c_args}]]`;
        case "eval":
            return parserType === "pack"
                ? `&evals[args[i_args + ${c_args}]*FIELD_EXTENSION*nrowsPack]`
                : `evals[args[i_args + ${c_args}]]`;
        case "airgroupvalue":
            if(global) {
                return `&airgroupValues[args[i_args + ${c_args}]][args[i_args + ${c_args + 1}] * FIELD_EXTENSION]`;
            } else {
                return parserType === "pack"
                ? `&airgroupValues[args[i_args + ${c_args}]*FIELD_EXTENSION*nrowsPack]`
                : `airgroupValues[args[i_args + ${c_args}]]`;
            }
        case "airvalue1":
            return parserType === "pack"
            ? `&airValues[args[i_args + ${c_args}]*FIELD_EXTENSION*nrowsPack]`
            : `airValues[args[i_args + ${c_args}]][0]`;
        case "airvalue3":
            return parserType === "pack"
            ? `&airValues[args[i_args + ${c_args}]*FIELD_EXTENSION*nrowsPack]`
            : `airValues[args[i_args + ${c_args}]]`;
        case "number":
            return parserType === "pack" 
                ? `&numbers_[args[i_args + ${c_args}]*nrowsPack]`
                : `numbers_[args[i_args + ${c_args}]]`;
        default:
            throw new Error("Invalid type: " + type);
    }
}


module.exports.numberOfArgs = function numberOfArgs(type, global = false) {
    if(global && !["public", "number", "airgroupvalue", "tmp1", "tmp3", "proofvalue", "challenge"].includes(type)) {
        throw new Error("Global constraints only allow for publics, numbers, proofvalues and airgroupValues");
    }
    switch (type) {
        case "public":            
        case "tmp1":
        case "tmp3":
        case "challenge":
        case "eval":
        case "number":
        case "airvalue1":
        case "airvalue3":
        case "proofvalue":
            return 1;
        case "airgroupvalue":
            return global ? 2 : 1;
        case "const":
        case "commit1":
        case "commit3":
            return 2;  
        default:
            throw new Error("Invalid type: " + type);
    }
}


module.exports.getGlobalOperations = function getGlobalOperations() {
    const possibleOps = [];

    const possibleDestinationsDim1 = ["tmp1"];
    const possibleDestinationsDim3 = ["tmp3"];

    const possibleSrcDim1 = ["tmp1", "public", "number"];
    const possibleSrcDim3 = ["tmp3", "airgroupvalue", "proofvalue", "challenge"];

    // Dim1 destinations
    for(let j = 0; j < possibleDestinationsDim1.length; j++) {
        let dest_type = possibleDestinationsDim1[j];
        for(let k = 0; k < possibleSrcDim1.length; ++k) {
            let src0_type = possibleSrcDim1[k];
            for (let l = k; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type})
            } 
        }
    }

    // Dim3 destinations
    for(let j = 0; j < possibleDestinationsDim3.length; j++) {
        let dest_type = possibleDestinationsDim3[j];


        // Dest dim 3, sources dimension 3 and 1
        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            
            for (let l = 0; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type});
            }
        }

        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            for (let l = k; l < possibleSrcDim3.length; ++l) {
                let src1_type = possibleSrcDim3[l];
                possibleOps.push({dest_type, src0_type, src1_type})
            }
        }
    }
    
    return possibleOps;
}

module.exports.getAllOperations = function getAllOperations() {
    const possibleOps = [];

    const possibleDestinationsDim1 = [ "tmp1" ];
    const possibleDestinationsDim3 = [ "tmp3" ];

    const possibleSrcDim1 = [ "commit1", "tmp1", "public", "number", "airvalue1" ];
    const possibleSrcDim3 = [ "commit3", "tmp3", "challenge", "airgroupvalue", "airvalue3" ];

    // Dim1 destinations
    for(let j = 0; j < possibleDestinationsDim1.length; j++) {
        let dest_type = possibleDestinationsDim1[j];
        for(let k = 0; k < possibleSrcDim1.length; ++k) {
            let src0_type = possibleSrcDim1[k];
            possibleOps.push({dest_type, src0_type}); // Copy operation for PIL1
            for (let l = k; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type})
            } 
        }
    }

    // Dim3 destinations
    for(let j = 0; j < possibleDestinationsDim3.length; j++) {
        let dest_type = possibleDestinationsDim3[j];


        // Dest dim 3, sources dimension 3 and 1
        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            
            for (let l = 0; l < possibleSrcDim1.length; ++l) {
                let src1_type = possibleSrcDim1[l];
                possibleOps.push({dest_type, src0_type, src1_type});
            }
        }

        for(let k = 0; k < possibleSrcDim3.length; ++k) {
            let src0_type = possibleSrcDim3[k];
            if(["commit3", "tmp3"].includes(src0_type)) possibleOps.push({dest_type, src0_type}); // Copy operation for PIL1
            for (let l = k; l < possibleSrcDim3.length; ++l) {
                let src1_type = possibleSrcDim3[l];
                possibleOps.push({dest_type, src0_type, src1_type})
            }
        }
    }

    // Step FRI
    possibleOps.push({ dest_type: "tmp3", src0_type: "eval"}); // Copy operation for PIL1
    possibleOps.push({ dest_type: "tmp3", src0_type: "challenge", src1_type: "eval"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "tmp3", src1_type: "eval"});

    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "commit1"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "commit3", src1_type: "eval"});
    
    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "eval"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "public"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "eval", src1_type: "number"});
    possibleOps.push({ dest_type: "tmp3", src0_type: "airgroupvalue", src1_type: "eval"});

    return possibleOps;
}