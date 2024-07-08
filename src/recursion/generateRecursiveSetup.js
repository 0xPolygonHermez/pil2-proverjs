
const util = require('util');
const path = require('path');
const exec = util.promisify(require('child_process').exec);
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const fs = require('fs');
const { compile } = require('pilcom');
const pil2circom = require('stark-recurser/src/pil2circom/pil2circom.js');
const {compressorSetup} = require('stark-recurser/src/circom2pil/compressor_setup');
const {genCircom} = require('stark-recurser/src/gencircom.js');
const { genNullProof } = require('stark-recurser/src/pil2circom/proof2zkin');

const F3g = require('pil2-stark-js/src/helpers/f3g');
const buildMerkleHashGL = require("pil2-stark-js/src/helpers/hash/merklehash/merklehash_p.js");
const { starkSetup } = require('pil2-stark-js');

module.exports.genRecursiveSetup = async function genRecursiveSetup(template, subproofName, subproofId, airId, globalInfo, constRoot, verificationKeys = [], starkInfo, verifierInfo, starkStruct, compressorCols, hasCompressor) {

    const F = new F3g();

    let inputChallenges = false;
    let verkeyInput = false;
    let enableInput = false;
    let verifierName;
    let verifierFilename;
    let templateFilename;
    let recursiveFilename;
    let r1csFilename;
    let pilFilename;
    let filesDir;
    let constRootCircuit = constRoot || [];
    if((template === "recursive1" && !hasCompressor) || template === "compressor") {
        inputChallenges = true;
        verifierName = `${subproofName}_${airId}.verifier.circom`;
        verifierFilename = `tmp/circom/${verifierName}`;
        recursiveFilename = `tmp/circom/${template}_${subproofName}_${airId}.circom`;
        r1csFilename = `tmp/build/${template}_${subproofName}_${airId}.r1cs`;
        pilFilename = `tmp/pil/${template}_${subproofName}_${airId}.pil`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/compressor.circom.ejs`;
        filesDir = `tmp/config/${globalInfo.name}/${subproofName}/airs/${subproofName}_${airId}/${template}`;
    } else if(template === "recursive1") {
        verifierName = `compressor_${subproofName}_${airId}.verifier.circom`;
        verifierFilename = `tmp/circom/${verifierName}`;
        recursiveFilename = `tmp/circom/${template}_${subproofName}_${airId}.circom`;
        r1csFilename = `tmp/build/${template}_${subproofName}_${airId}.r1cs`;
        pilFilename = `tmp/pil/${template}_${subproofName}_${airId}.pil`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/recursive1.circom.ejs`;
        filesDir = `tmp/config/${globalInfo.name}/${subproofName}/airs/${subproofName}_${airId}/recursive1/`;
    } else if (template === "recursive2") {
        verifierName = `recursive2_${subproofName}.verifier.circom`;
        verifierFilename = `tmp/circom/${verifierName}`;
        recursiveFilename = `tmp/circom/${template}_${subproofName}.circom`;
        r1csFilename = `tmp/build/${template}_${subproofName}.r1cs`;
        pilFilename = `tmp/pil/${template}_${subproofName}.pil`;
        templateFilename = `node_modules/stark-recurser/src/vadcop/templates/recursive2.circom.ejs`;
        filesDir = `tmp/config/${globalInfo.name}/${subproofName}/${template}`;
        enableInput = globalInfo.aggTypes.length > 1 ? true : false;
        verkeyInput = true;
    }

    const options = { skipMain: true, verkeyInput, enableInput, inputChallenges, subproofId, hasCompressor }
        
    //Generate circom
    const verifierCircomTemplate = await pil2circom(constRootCircuit, starkInfo, verifierInfo, options);
    await fs.promises.mkdir(path.dirname(verifierFilename), { recursive: true });
    await fs.promises.writeFile(verifierFilename, verifierCircomTemplate, "utf8");

    const recursiveVerifier = await genCircom(templateFilename, [starkInfo], globalInfo, [verifierName], verificationKeys, [], [], options);
    await fs.promises.mkdir(path.dirname(recursiveFilename), { recursive: true });
    await fs.promises.writeFile(recursiveFilename, recursiveVerifier, "utf8");

    // Compile circom
    await fs.promises.mkdir(path.dirname(r1csFilename), { recursive: true });
    const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks --inspect --wasm --c --verbose -l node_modules/stark-recurser/src/vadcop/helpers/circuits -l node_modules/stark-recurser/src/pil2circom/circuits.gl ${recursiveFilename} -o tmp/build`;
    await exec(compileRecursiveCommand);

    // Generate setup
    const {exec: execBuff, pilStr, constPols} = await compressorSetup(F, r1csFilename, compressorCols);

    await fs.promises.mkdir(path.dirname(`${filesDir}/${template}.const`), { recursive: true });

    await constPols.saveToFile(`${filesDir}/${template}.const`);

    const fd =await fs.promises.open(`${filesDir}/${template}.exec`, "w+");
    await fd.write(execBuff);
    await fd.close();

    await fs.promises.mkdir(path.dirname(pilFilename), { recursive: true });
    await fs.promises.writeFile(pilFilename, pilStr, "utf8");

    // Build stark info
    const pilRecursive = await compile(F, pilFilename);

    const setup = await starkSetup(constPols, pilRecursive, starkStruct, {F, pil2: false, subproofId, airId});

    await fs.promises.writeFile(`${filesDir}/${template}.verkey.json`, JSONbig.stringify(setup.constRoot, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.starkinfo.json`, JSON.stringify(setup.starkInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.verifierinfo.json`, JSON.stringify(setup.verifierInfo, null, 1), "utf8");

    await fs.promises.writeFile(`${filesDir}/${template}.expressionsinfo.json`, JSON.stringify(setup.expressionsInfo, null, 1), "utf8");

    const MH = await buildMerkleHashGL();
    await MH.writeToFile(setup.constTree, `${filesDir}/${template}.consttree`);

    if(template === "recursive2") {
        const vks = {
            rootCRecursives1: verificationKeys,
            rootCRecursive2: setup.constRoot,
        }
        await fs.promises.writeFile(`${filesDir}/${template}.vks.json`, JSONbig.stringify(vks, 0, 1), "utf8");
        
        if(globalInfo.aggTypes.length > 1) {
            const nullProof = genNullProof(setup.starkInfo);
            await fs.promises.writeFile(`tmp/config/${globalInfo.name}/${subproofName}/recursive2/recursive2_${subproofName}_null.proof.zkin.json`, JSON.stringify(nullProof, 0, 1), "utf8");
        }
    }

    return { constRoot: setup.constRoot, starkInfo: setup.starkInfo, verifierInfo: setup.verifierInfo, pil: pilStr }

}