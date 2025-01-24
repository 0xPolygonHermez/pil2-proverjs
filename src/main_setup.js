const fs = require("fs");
const version = require("../package").version;

const setupCmd = require("./cmd/setup_cmd");

const argv = require("yargs")
    .version(version)
    .usage("node main_gensetup.js -a <airout.ptb> -s <starkstructs.json> -b <buildDir> ")
    .alias("a", "airout")
    .alias("b", "builddir")
    .alias("i", "binfiles").array("i")
    .alias("s", "starkstructs")
    .alias("r", "recursive")
    .alias("m", "impols")
    .alias("p", "publicsinfo")
    .alias("w", "ptau")
    .alias("f", "final")
    .alias("c", "cexec")
        .argv;

async function run() {

    const buildDir = argv.builddir || "tmp";
    await fs.promises.mkdir(buildDir, { recursive: true });

    if (!argv.cexec) {
        throw new Error("C++ build executables path must be provided");
    }

    let constTree = `${argv.cexec}/bctree`;
    if (!fs.existsSync(constTree)) {
        throw new Error("Bctree path must be provided and must be an executable file");
    }

    let binFile = `${argv.cexec}/binfile`;
    if (!fs.existsSync(binFile)) {
        throw new Error("BinFile path must be provided and must be an executable file");
    }

    let publicsInfo;
    let powersOfTauFile;
    let fflonkSetup;
    if(argv.final && !argv.recursive) {
        throw new Error("Only can generate the final snark if recursive part is activated");
    }

    if(argv.recursive) {
        if(argv.final) {
            if(!argv.ptau) {
                throw new Error("PowersOfTau file must be provided in order to generate final snark");
            }
            if(!argv.publicsinfo) {
                throw new Error("Publics info must be provided in order to generate final snark");
            }
            fflonkSetup = `${argv.cexec}/fflonkSetup`;
            if (!fs.existsSync(fflonkSetup)) {
                throw new Error("Fflonk setup path must be provided and must be an executable file");
            }
            powersOfTauFile = argv.ptau;
            publicsInfo = JSON.parse(await fs.promises.readFile(argv.publicsinfo, "utf8"))
        }
    }

    let piloutPath = argv.airout;

    let starkStructsInfo = argv.starkstructs ? JSON.parse(await fs.promises.readFile(argv.starkstructs, "utf8")) : {};
    
    const binFiles = argv.binfiles || [];

    const config = {
        airout: {
            airoutFilename: piloutPath,
        },
        setup: {
            settings: starkStructsInfo,
            genAggregationSetup: argv.recursive || false,
            genFinalSnarkSetup: argv.final || false,
            optImPols: argv.impols || false,
            constTree,
            publicsInfo,
            binFiles,
            fflonkSetup,
            binFile,
            powersOfTauFile,
        }
    }

    await setupCmd(config, buildDir);

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

