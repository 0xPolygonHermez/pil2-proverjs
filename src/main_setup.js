const fs = require("fs");
const version = require("../package").version;

const setupCmd = require("./cmd/setup_cmd");

const argv = require("yargs")
    .version(version)
    .usage("node main_gensetup.js -a <airout.ptb> -s <starkstructs.json> -b <buildDir> ")
    .alias("a", "airout")
    .alias("b", "builddir")
    .alias("s", "starkstructs")
    .alias("t", "consttree")
    .alias("r", "recursive")
    .alias("m", "impols")
    .alias("p", "publicsinfo")
    .alias("w", "ptau")
    .alias("f", "final")
        .argv;

async function run() {

    const buildDir = argv.builddir || "tmp";
    await fs.promises.mkdir(buildDir, { recursive: true });

    if (!argv.consttree || !fs.existsSync(argv.consttree)) {
        throw new Error("Bctree path must be provided and must be an executable file");
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
            fflonkSetup = argv.final;
            powersOfTauFile = argv.ptau;
            publicsInfo = JSON.parse(await fs.promises.readFile(argv.publicsinfo, "utf8"))
        }
    }

    let piloutPath = argv.airout;

    let starkStructsInfo = argv.starkstructs ? JSON.parse(await fs.promises.readFile(argv.starkstructs, "utf8")) : {};
    
    const config = {
        airout: {
            airoutFilename: piloutPath,
        },
        setup: {
            settings: starkStructsInfo,
            genAggregationSetup: argv.recursive || false,
            genFinalSnarkSetup: argv.final || false,
            optImPols: argv.impols || false,
            constTree: argv.consttree,
            publicsInfo,
            fflonkSetup,
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

