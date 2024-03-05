const { ethers } = require("hardhat");

async function main() {
    // const [deployer] = await ethers.getSigners();

    const Farming = await ethers.deployContract("Farming");
    await Farming.waitForDeployment();

    const proxy = await ethers.deployContract("Proxy1967", [Farming.target, '0x8129fc1c']);
    await proxy.waitForDeployment();

    console.log(`Farming proxy deployed at: ${proxy.target} Impl at: ${Farming.target}`);
    
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});