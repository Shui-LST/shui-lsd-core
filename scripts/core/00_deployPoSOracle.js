const hre = require("hardhat");
const { deployContract } = require("./init");

main().catch(console.log);

async function main() {
    await deployPoSOracle();
}

async function deployPoSOracle() {
    await deployContract(hre, "PoSOracle");
}