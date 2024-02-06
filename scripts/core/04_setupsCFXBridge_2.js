const hre = require("hardhat");
const { logReceipt } = require("./init");

main().catch(console.log);

async function main() {
    await setupsCFXBridge();
}

// set voting escrow addr in sCFXBridge
async function setupsCFXBridge() {
    const [account] = await hre.conflux.getSigners();
    let contract = await conflux.getContractAt(
        "sCFXBridge",
        process.env.sCFX_BRIDGE
    );

    const receipt2 = await contract
        .setEspaceVotingEscrow(process.env.ESPACE_VOTING_ESCROW)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt2, "sCFXBridge set eSpaceVotingEscrow");
}
