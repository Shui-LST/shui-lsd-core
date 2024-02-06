const { ethers } = require("hardhat");

async function main() {
    // const [deployer] = await ethers.getSigners();

    const VotingEscrow = await ethers.deployContract("EVotingEscrow");
    await VotingEscrow.waitForDeployment();

    const proxy = await ethers.deployContract("Proxy1967", [VotingEscrow.target, '0x8129fc1c']);
    await proxy.waitForDeployment();

    console.log(`VotingEscrow proxy deployed at: ${proxy.target} Impl at: ${VotingEscrow.target}`);
    
    const voting = await ethers.getContractAt("EVotingEscrow", proxy.target);
    
    const tx = await voting.setCoreSpaceInfo(process.env.CORE_SPACE_INFO);
    await tx.wait();    
    console.log(`set setCoreSpaceInfo ${process.env.CORE_SPACE_INFO}`);

    const tx2 = await voting.setSCFX(process.env.sCFX);
    await tx2.wait();    
    console.log(`set VotingEscrow SCFX ${process.env.sCFX}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});