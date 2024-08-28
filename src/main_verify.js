const fs = require("fs");
const version = require("../package").version;

const path = require("path");

const verifyCmd = require("./cmd/verify_cmd");
const { assert } = require("chai");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_verify.js -a airout -k proving_key -p <proofsDir> ")
    .alias("k", "provingkey")
    .alias("p", "proofsdir")
        .argv;

async function run() {
    
    if(!argv.provingkey) throw new Error("Proving key path must be provided");

    if(!argv.proofsdir) throw new Error("Proofs directory must be provided");


    const publics = JSONbig.parse(await fs.promises.readFile(path.join(argv.proofsdir, "publics.json")));
    const challenges = JSONbig.parse(await fs.promises.readFile(path.join(argv.proofsdir, "challenges.json")));

    const proofsFiles = await fs.promises.readdir(path.join(argv.proofsdir, "proofs"));

    const proofs = [];

    for(let i = 0; i < proofsFiles.length; ++i) {
        const proof = JSONbig.parse(await fs.promises.readFile(path.join(argv.proofsdir, "proofs", proofsFiles[i])));
        proofs.push(proof);
    }

    const globalInfo = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalInfo.json")));

    const globalConstraints = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalConstraints.json")));

    const airoutInfo = {...globalInfo, globalConstraints};
    
    const setups = [];
    
    for(let i = 0; i < globalInfo.airs.length; ++i) {
        const setupsAir = [];
        for(let j = 0; j < globalInfo.airs[i].length; ++j) {
            const airName = globalInfo.airs[i][j].name;
            const pathAir = path.join(argv.provingkey, "provingKey", globalInfo.name, globalInfo.subproofs[i], "airs", globalInfo.airs[i][j].name, "air");
            
            const starkInfo = JSON.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.starkinfo.json`), "utf8"));
        
            const verifierInfo = JSON.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.verifierinfo.json`), "utf8"));
        
            const constRoot = JSONbig.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.verkey.json`), "utf8"));
            
            setupsAir.push({
                starkInfo,
                verifierInfo, 
                constRoot,
            })
        }
        setups.push(setupsAir);
    }

    const config = {
        name: globalInfo.name + "-" + Date.now(),
        verifier: { filename:  path.join(__dirname, "/lib/provers/stark_fri_verifier.js") }
    }

    const setup = {
        config,
        airoutInfo,
        setup: setups,
    }

    const options = {
        vadcop: true,
    }

    const isValid = await verifyCmd(setup, proofs, challenges, publics, options);

    assert(isValid == true, "PROOF NOT VALID");

    console.log("PROOF VALID");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

