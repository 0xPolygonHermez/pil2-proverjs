const fs = require("fs");
const version = require("../package").version;

const path = require("path");

const proveCmd = require("./cmd/prove_cmd");
const { AirOut } = require("./airout");
const { generateFixedCols } = require("pil2-stark-js/src/witness/witnessCalculator");
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { assert } = require("chai");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_verifyConstraints.js -a airout -p proving_key -i <publics.json>  ")
    .alias("a", "airout")
    .alias("p", "provingkey")
    .alias("i", "publics")
    .alias("w", "witnesscalculators")
        .argv;

async function run() {
    
    if(!argv.airout) throw new Error("Airout must be provided");

    if(!argv.provingkey) throw new Error("Proving key path must be provided");

    if(!argv.witnesscalculators) throw new Error("Witness Calculators must be provided");

    const witnessCalculators = JSON.parse(await fs.promises.readFile(argv.witnesscalculators));

    const publics = !argv.publics ? [5n, 1n, 1n, undefined] : JSON.parse(await fs.promises.readFile(argv.publics));

    const globalInfo = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalInfo.json")));

    if(publics.length !== globalInfo.nPublics) throw new Error("Something went wrong when loading publics");

    const globalConstraints = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalConstraints.json")));

    const airoutInfo = {...globalInfo, globalConstraints};

    const airout = new AirOut(argv.airout);

    
    const setups = [];
    
    for(let i = 0; i < globalInfo.airs.length; ++i) {
        const setupsAir = [];
        for(let j = 0; j < globalInfo.airs[i].length; ++j) {
            const air = airout.subproofs[i].airs[j];
            const airName = globalInfo.airs[i][j].name;
            const pathAir = path.join(argv.provingkey, "provingKey", globalInfo.name, globalInfo.subproofs[i], "airs", globalInfo.airs[i][j].name, "air");
            
            const starkInfo = JSON.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.starkinfo.json`), "utf8"));

            const expressionsInfo = JSON.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.expressionsinfo.json`), "utf8"));
        
            const verifierInfo = JSON.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.verifierinfo.json`), "utf8"));
        
            const constRoot = JSONbig.parse(await fs.promises.readFile(path.join(pathAir, `${airName}.verkey.json`), "utf8"));
            
            const fixedPols = generateFixedCols(air.symbols, air.numRows);
            await fixedPols.loadFromFile(path.join(pathAir, `${airName}.const`));

            const MH = await buildMerkleHashGL();

            const constTree = await MH.readFromFile(path.join(pathAir, `${airName}.consttree`));
            
            setupsAir.push({
                fixedPols,
                starkInfo,
                expressionsInfo,
                verifierInfo, 
                constTree,
                constRoot,
            })
        }
        setups.push(setupsAir);
    }

    const config = {
        name: globalInfo.name + "-" + Date.now(),
        witnessCalculators,
        airout: {
            airoutFilename: argv.airout,
        },
        prover: {
            filename: "./src/lib/provers/stark_fri_prover.js",
        },
    }

    const setup = {
        config,
        airoutInfo,
        setup: setups,
    }

    const options = {
        parallelExec: true,
        useThreads: true,
        vadcop: true,
        onlyCheck: true,
    }

    const isValid = await proveCmd(setup, publics, options);
    
    assert(isValid == true, "PROOF CONSTRAINTS UNSUCCESSFULLY FULLFILLED.");

    console.log("CONSTRAINTS VERIFIED SUCCESSFULLY");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

