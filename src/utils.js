const fs =require("fs");

async function fileExists(path) {
    return fs.promises.access(path, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
}

module.exports = {
    fileExists,
}
