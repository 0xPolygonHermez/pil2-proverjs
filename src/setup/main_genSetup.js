const fs = require("fs");
const version = require("../../package").version;

const path = require("path");

const compilePil2 = require("pil2-compiler/src/compiler.js");
const setupCmd = require("../cmd/setup_cmd");
const F3g = require("pil2-stark-js/src/helpers/f3g");

const argv = require("yargs")
    .version(version)
    .usage("node main_gensetup.js -p <pil.json> -a <airout.ptb> -s <starkstructs.json> -b <buildDir> ")
    .alias("a", "airout")
    .alias("p", "pil")
    .alias("b", "builddir")
    .alias("s", "starkstructs")
    .alias("r", "recursive")
        .argv;

async function run() {
    if(!argv.airout && !argv.pil) throw new Error("Either pilout or pil file needs to be provided!");
    if(argv.airout && argv.pil) throw new Error("Only one out of pilout and pil files needs to be provided!");

    const buildDir = argv.builddir || "tmp";
    await fs.promises.mkdir(buildDir, { recursive: true });

    const F = new F3g();

    let piloutFile = argv.airout.trim();
    let piloutPath;
    if(argv.pil) {
        piloutPath = path.join(buildDir, "pilout.ptb");
        let pilConfig = { outputFile: piloutPath };
        compilePil2(F, piloutFile, null, pilConfig);
    } else {
        piloutPath = argv.airout;
    }

    let starkStructsInfo = argv.starkstructs ? JSON.parse(await fs.promises.readFile(argv.starkstructs, "utf8")) : {};
    
    const config = {
        airout: {
            airoutFilename: piloutPath,
        },
        setup: {
            settings: starkStructsInfo,
            genAggregationSetup: argv.recursive || false,
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

