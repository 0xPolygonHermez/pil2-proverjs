const fs = require("fs");
const version = require("../package").version;

const path = require("path");

const proveCmd = require("./cmd/prove_cmd");
const { AirOut } = require("./airout");
const { generateFixedCols } = require("pil2-stark-js/src/witness/witnessCalculator");
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_prove.js -a -p proving_key -i <publics.json> -b <buildDir> ")
    .alias("a", "airout")
    .alias("p", "provingkey")
    .alias("i", "publics")
    .alias("w", "witnesscalculators")
    .alias("o", "outputdir")
        .argv;

async function run() {
    
    if(!argv.airout) throw new Error("Airout must be provided");

    if(!argv.provingkey) throw new Error("Proving key path must be provided");

    if(!argv.witnesscalculators) throw new Error("Witness Calculators must be provided");

    const outputDir = argv.outputdir ? argv.outputdir.trim() : "tmp/proofs";

    await fs.promises.mkdir(`${outputDir}/proofs`, { recursive: true });

    const witnessCalculators = JSON.parse(await fs.promises.readFile(argv.witnesscalculators), (key, value) => {
        if (key === 'filename') {
            return path.resolve(value);
        }
        return value;
    });

    const globalInfo = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalInfo.json")));

    const globalConstraints = JSON.parse(await fs.promises.readFile(path.join(argv.provingkey, "provingKey", "pilout.globalConstraints.json")));

    const airoutInfo = {...globalInfo, globalConstraints};

    const airout = new AirOut(argv.airout);

    const publicsJSON =  JSON.parse(await fs.promises.readFile(argv.publics));
    
    const publics = new Array(globalInfo.nPublics);

    for(let i = 0; i < airout.symbols.length; ++i) {
        const symbol = airout.symbols[i];
        if(symbol.type !== 6) continue;
        const value = publicsJSON[symbol.name];
        if(value != undefined) publics[symbol.id] = BigInt(value);
    }
    
    const setups = [];
    
    for(let i = 0; i < globalInfo.airs.length; ++i) {
        const setupsAir = [];
        for(let j = 0; j < globalInfo.airs[i].length; ++j) {
            const air = airout.airgroups[i].airs[j];
            const airName = globalInfo.airs[i][j].name;
            const pathAir = path.join(argv.provingkey, "provingKey", globalInfo.name, globalInfo.airgroups[i], "airs", globalInfo.airs[i][j].name, "air");
            
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
            airoutFilename: path.resolve(argv.airout),
        },
        prover: {
            filename:  path.join(__dirname, "/lib/provers/stark_fri_prover.js"),
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
    }

    const proofs = await proveCmd(setup, publics, options);

    for(let i = 0; i < proofs.proofs.length; ++i) {
        const proof = proofs.proofs[i];
        await fs.promises.writeFile(path.join(outputDir, "proofs", `proof_${i}.json`), JSONbig.stringify(proof, null, 1), "utf8");
    }

    await fs.promises.writeFile(path.join(outputDir, `publics.json`), JSONbig.stringify(proofs.publics, null, 1), "utf8");
    await fs.promises.writeFile(path.join(outputDir, `challenges.json`), JSONbig.stringify(proofs.challenges, null, 1), "utf8");

    console.log("Proof Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

