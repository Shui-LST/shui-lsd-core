require("dotenv").config();
const { network } = require("hardhat");
const { Conflux, Drip } = require("js-conflux-sdk");
const { loadPrivateKey } = require("../util");

const conflux = new Conflux({
    url: network.config.url,
    networkId: network.config.chainId,
});

function logReceipt(receipt, msg) {
    console.log(
        `${new Date().toLocaleString()} ${msg}: ${
            receipt.outcomeStatus === 0 ? "Success" : "Fail"
        } hash-${receipt.transactionHash}`
    );
}

async function deployContract(hre, name, value = 0, ...params) {
    console.log("Start to deploy", name);
    const [account] = await hre.conflux.getSigners();
    const Contract = await hre.conflux.getContractFactory(name);

    const deployReceipt = await Contract.constructor(...params)
        .sendTransaction({
            from: account.address,
            value,
        })
        .executed();

    if (deployReceipt.outcomeStatus === 0) {
        console.log(`${name} deployed to:`, deployReceipt.contractCreated);
        return deployReceipt.contractCreated;
    } else {
        console.log(`${name} deploy failed`);
        return null;
    }
}

const InitializerSig = "0x8129fc1c";

const account = conflux.wallet.addPrivateKey(loadPrivateKey('cPRIVATE_KEY'));

module.exports = {
    conflux,
    logReceipt,
    account,
    deployContract,
    InitializerSig,
    Drip
};
