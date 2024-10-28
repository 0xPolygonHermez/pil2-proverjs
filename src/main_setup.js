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
        .argv;

async function run() {

    const buildDir = argv.builddir || "tmp";
    await fs.promises.mkdir(buildDir, { recursive: true });

    let piloutPath = argv.airout;

    let starkStructsInfo = argv.starkstructs ? JSON.parse(await fs.promises.readFile(argv.starkstructs, "utf8")) : {};
    
    const config = {
        airout: {
            airoutFilename: piloutPath,
        },
        setup: {
            settings: starkStructsInfo,
            genAggregationSetup: argv.recursive || false,
            optImPols: argv.impols || false
        }
    }

    if(argv.consttree) {
        config.setup.constTree = argv.consttree;
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

