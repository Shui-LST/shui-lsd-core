const hre = require("hardhat");
const { deployContract, InitializerSig } = require("./init");

main().catch(console.log);

async function main() {
    await deploysCFXBridge();
}

async function deploysCFXBridge() {
    let addr = await deployContract(hre, "sCFXBridge");
    await deployContract(hre, "Proxy1967", 0, addr, InitializerSig);
}
