const { ethers } = require("hardhat");

async function main() {
    const Contract = await ethers.deployContract("sCFX");
    await Contract.waitForDeployment();

    const proxy = await ethers.getContractAt("Proxy1967", process.env.sCFX);

    const tx = await proxy.upgradeTo(Contract.target);
    await tx.wait();
    console.log(`Upgrade to ${Contract.target}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});