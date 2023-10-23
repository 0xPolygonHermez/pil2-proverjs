const { calculateHashStark } = require("pil2-stark-js");

async function hashValues(arr) {
    // Base case: If the array has only one element => return the hash of that element.
    if (arr.length === 1) return arr[0];

    const result = [];

    const ctx = {pilInfo: {starkStruct: {verificationHashType: "GL"}}};

    for (let i = 0; i < arr.length; i += 2) {
        if (i + 1 < arr.length) {
            // Hash the current element with the next element
            console.log(`Hash(${arr[i]}, ${arr[i + 1]})`);
            const hash = await calculateHashStark(ctx, [...arr[i], ...arr[i+1]]);
            result.push(hash);
        } else {
            // If there's an odd number of elements, leave the last one as is
            result.push(arr[i]);
        }
    }

    // Recursively call the function with the new array of hashes
    return hashValues(result);
}

async function testHash() {
    const elements = [];
    for(let i = 0; i < 13; ++i) {
        elements.push([i,i,i,i])
    }
    console.log(elements);
    const finalHash = await hashValues(elements);
    console.log(finalHash);
}

testHash();
