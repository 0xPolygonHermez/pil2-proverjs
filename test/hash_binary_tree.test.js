const { hashBTree } = require("../src/hash_binary_tree.js");

describe("Hash binary tree", async function () {
    this.timeout(10000000);

    it("test hash2", async () => {
        const elements = [];
        elements.push([1,1,1,1]);
        elements.push([2,2,2,2]);
        elements.push([3,3,3,3]);

        const finalHash = await hashBTree(elements);
        console.log(finalHash);        
    });

    it("test hash2", async () => {
        const elements = [];
        elements.push([1,1,1,1]);
        elements.push(0);
        elements.push([3,3,3,3]);

        const finalHash = await hashBTree(elements);
        console.log(finalHash);        
    });

    it("test hash3", async () => {
        const elements = [];
        elements.push(0);
        elements.push([2,2,2,2]);
        elements.push([3,3,3,3]);

        const finalHash = await hashBTree(elements);
        console.log(finalHash);        
    });

    it("test hash4", async () => {
        const elements = [];
        elements.push([1,1,1,1]);
        elements.push([2,2,2,2]);
        elements.push([3,3,3,3]);
        elements.push(0);

        const finalHash = await hashBTree(elements);
        console.log(finalHash);        
    });

});