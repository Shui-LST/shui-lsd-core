const { sign, format } = require("js-conflux-sdk");
const { ethers } = require("ethers");

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



const abiCoder = ethers.AbiCoder.defaultAbiCoder();

function abiEncode(method, paramsTypes, paramsValues) {
    const selector = ethers.id(method).slice(0, 10);
    const data = abiCoder.encode(paramsTypes, paramsValues);
    return selector + data.replace("0x", "");
}

function encodeEmptyInitialize() {
    const initializeSignature = "initialize()";
    const initializeSelector = ethers.id(initializeSignature).slice(0, 10);
    return initializeSelector;
}

function encodeInitalizeWithData(paramsTypes, paramsValues) {
    const initializeSignature = `initialize(${paramsTypes.join(",")})`;
    return abiEncode(initializeSignature, paramsTypes, paramsValues);
}

module.exports = {
    loadPrivateKey,
    abiEncode,
    encodeEmptyInitialize,
    encodeInitalizeWithData
};
