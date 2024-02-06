const { sign, format } = require("js-conflux-sdk");

function loadPrivateKey(keyName) {
    const val = process.env[keyName];
    if (!val) throw new Error(`Missing ${keyName} env variable`);
    
    if (val.startsWith("0x")) {
        return val;
    } else {
        const keystore = require(val);
        const privateKeyBuf = sign.decrypt(keystore, process.env[`${keyName}_PWD`]);
        return format.hex(privateKeyBuf);
    }
}

module.exports = {
    loadPrivateKey,
};
