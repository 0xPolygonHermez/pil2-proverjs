function hashArray(arr) {
    // Base case: If the array has only one element => return the hash of that element.
    if (arr.length === 1) return arr[0];

    const result = [];

    for (let i = 0; i < arr.length; i += 2) {
        if (i + 1 < arr.length) {
            // Hash the current element with the next element
            result.push(hashFunction(arr[i], arr[i + 1]));
        } else {
            // If there's an odd number of elements, leave the last one as is
            result.push(hashFunction(arr[i], 0));
        }
    }

    // Recursively call the function with the new array of hashes
    return hashArray(result, hashFunction);
}

function hashFunction(a, b) {
    console.log(`Hash(${a}, ${b})`);
    // Replace this with our hash
    return a.toString() + b.toString();
}

const elements = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const finalHash = hashArray(elements, hashFunction);
console.log(finalHash);
