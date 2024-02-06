const { ethers } = require("hardhat");

async function main() {
    const scfx = await ethers.getContractAt("sCFX", process.env.sCFX);
    
    const tx = await scfx.setVotingEscrow(process.env.ESPACE_VOTING_ESCROW);
    await tx.wait();    

    console.log(`set VotingEscrow in scfx`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});