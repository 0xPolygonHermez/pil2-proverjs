const {
    readBinFile,
    startReadUniqueSection,
    endReadSection 
} = require("@iden3/binfileutils");

const FIXED_POLS_SECTION = 1;

module.exports.readFixedPolsBin = async function readFixedPolsBin(fixedInfo, binFileName, F) {
    const { fd: fdBin, sections } = await readBinFile(binFileName, "cnst", 1, 1 << 25, 1 << 23);

    await startReadUniqueSection(fdBin, sections, FIXED_POLS_SECTION);
    const airgroupName = await fdBin.readString();
    const airName = await fdBin.readString();
    const N = await fdBin.readULE64();
    const nFixedPols = await fdBin.readULE32();
    const fixedPolsInfo = {};
    for(let i = 0; i < nFixedPols; ++i) {
        const name = await fdBin.readString();
        const n_lengths = await fdBin.readULE32();
        const lengths = [];
        for(let j = 0; j < n_lengths; ++j) {
            lengths.push(await fdBin.readULE32());
        }
        const buff = await fdBin.read(N * 8);
        const values = [];
        for (let l=0; l<N; l++) {
            values[l] = F.fromRprLE(buff, l*F.n8);
        }
        if(!fixedPolsInfo[name]) {
            fixedPolsInfo[name] = [];
        }
        fixedPolsInfo[name].push({ lengths, values });
    }
    
    
    await endReadSection(fdBin);

    await fdBin.close();

    fixedInfo[`${airgroupName}_${airName}`] = fixedPolsInfo;
}