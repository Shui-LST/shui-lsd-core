const { ethers } = require("hardhat");
const { encodeInitalizeWithData } = require("../util");

async function main() {
    const VeShui = await ethers.deployContract("veShui");
    await VeShui.waitForDeployment();

    const data = encodeInitalizeWithData(['address'], [process.env.SHUI]);
    const proxy = await ethers.deployContract("Proxy1967", [VeShui.target, data]);
    await proxy.waitForDeployment();

    console.log(`VeShui proxy deployed at: ${proxy.target} Impl at: ${VeShui.target}`);
    
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});