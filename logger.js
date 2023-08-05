const pino = require("pino");
const pretty = require("pino-pretty");

const stream = pretty({
    colorize: true,
});
module.exports = pino(stream);
