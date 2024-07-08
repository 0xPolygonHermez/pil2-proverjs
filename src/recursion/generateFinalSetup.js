
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');

const F3g = require('pil2-stark-js/src/helpers/f3g');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { starkSetup } = require('pil2-stark-js');

const { compressorSetup } = require('stark-recurser/src/circom2pil/compressor_setup.js');
const { genCircom } = require('stark-recurser/src/gencircom.js');


module.exports.genFinalSetup = async function genFinalSetup(starkStructFinal, compressorCols) {
    const F = new F3g();

    const starkInfos = [];
    const verifierInfos = [];
    const aggregatedKeysRecursive2 = [];
    const basicKeysRecursive1 = [];
    const verifierNames = [];

    const finalFilename = `tmp/circom/final.circom`;

    const globalInfo = JSON.parse(await fs.promises.readFile(`tmp/config/airout.globalInfo.json`, "utf8"));

    const globalConstraints = JSON.parse(await fs.promises.readFile(`tmp/config/airout.globalConstraints.json`, "utf8"));

    for(let i = 0; i < globalInfo.aggTypes.length; i++) {
        const starkInfo = JSON.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2.starkinfo.json`, "utf8"));
        const verifierInfo = JSON.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2.verifierinfo.json`, "utf8"));
        const verificationKeys = JSONbig.parse(await fs.promises.readFile(`tmp/config/${globalInfo.name}/${globalInfo.subproofs[i]}/recursive2/recursive2.vks.json`, "utf8"));

        starkInfos.push(starkInfo);
        verifierInfos.push(verifierInfo);
        aggregatedKeysRecursive2.push(verificationKeys.rootCRecursive2);
        basicKeysRecursive1.push(verificationKeys.rootCRecursives1);
        verifierNames.push( `recursive2_${globalInfo.subproofs[i]}.verifier.circom`);
    }
        
    const filesDir = `tmp/final`;

    let templateFilename = `node_modules/stark-recurser/src/vadcop/templates/final.circom.ejs`;

    // Generate final circom
    const finalVerifier = await genCircom(templateFilename, starkInfos, {...globalInfo, globalConstraints }, verifierNames, basicKeysRecursive1, aggregatedKeysRecursive2);
    await fs.promises.writeFile(finalFilename, finalVerifier, "utf8");


    // Compile circom
    console.log("Compiling " + finalFilename + "...");
    const compileFinalCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --c --verbose -l node_modules/stark-recurser/src/vadcop/helpers/circuits -l node_modules/pil2-stark-js/circuits.gl ${finalFilename} -o tmp/build`;
    const execCompile = await exec(compileFinalCommand);
    console.log(execCompile.stdout);

    // Generate setup
    const finalR1csFile = `tmp/build/final.r1cs`;
    const {exec: execBuff, pilStr, constPols} = await compressorSetup(F, finalR1csFile, compressorCols);

    const fd =await fs.promises.open(`${filesDir}/final.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    const pilFilename = `tmp/pil/final.pil`
    await fs.promises.writeFile(pilFilename, pilStr, "utf8");

    // Compile pil
    const pilFinal = await compile(F, pilFilename);

    // Build stark info
    const setup = await starkSetup(constPols, pilFinal, starkStructFinal, {F, pil2: false});

    await fs.promises.writeFile(`${filesDir}/final.verkey.json`, JSONbig.stringify(setup.constRoot, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/final.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");

    const MH = await buildMerkleHashGL();
    await MH.writeToFile(setup.constTree, `${filesDir}/final.consttree`);
    
    return {starkInfoFinal: setup.starkInfo, verifierInfoFinal: setup.verifierInfo, constRootFinal: setup.constRoot};
}