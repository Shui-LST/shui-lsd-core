const { ethers } = require("hardhat");
const { address } = require("js-conflux-sdk");
async function main() {
    const VotingEscrow = await ethers.deployContract("EVotingEscrow");
    await VotingEscrow.waitForDeployment();

    const proxy = await ethers.getContractAt("Proxy1967", process.env.ESPACE_VOTING_ESCROW);

    const tx = await proxy.upgradeTo(VotingEscrow.target);
    await tx.wait();
    console.log(`set VotingEscrow core bridge ${address.cfxMappedEVMSpaceAddress(process.env.sCFX_BRIDGE)}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});