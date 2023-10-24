const { calculateHashStark } = require("pil2-stark-js");

async function hashBTree(arr) {
    // Base case: If the array has only one element => return the hash of that element.
    if (arr.length === 1) return arr[0];

    const result = [];

    const ctx = {pilInfo: {starkStruct: {verificationHashType: "GL"}}};

    if (0 !== arr.length % 2) arr.push(0);

    for (let i = 0; i < arr.length; i += 2) {
        if(arr[i] === 0 && arr[i+1] === 0) {
            // console.log(`Hash(0)`);
            result.push(0);
        } else if(arr[i] === 0) {
            // console.log(`Hash(0, ${arr[i + 1]})`);
            result.push(arr[i+1]);
        } else if(arr[i+1] === 0) {
            // console.log(`Hash(${arr[i]}, 0)`);
            result.push(arr[i]);
        } else {
            // Hash the current element with the next element
            // console.log(`Hash(${arr[i]}, ${arr[i + 1]})`);
            const hash = await calculateHashStark(ctx, [...arr[i], ...arr[i+1]]);
            result.push(hash);
        }
    }

    // Recursively call the function with the new array of hashes
    return hashBTree(result);
}

// async function testHash() {
//     const elements = [];
//     for(let i = 0; i < 13; ++i) {
//         elements.push([i,i,i,i])
//     }

//     const finalHash = await hashBTree(elements);
//     console.log(finalHash);
// }

// testHash();

module.exports = { hashBTree };
