const hre = require("hardhat");
const { logReceipt } = require("./init");

main().catch(console.log);

async function main() {
    await setupsCFXBridge();
}

// set SHUI treasury addr in sCFXBridge
async function setupsCFXBridge() {
    const [account] = await hre.conflux.getSigners();
    let contract = await conflux.getContractAt(
        "sCFXBridge",
        process.env.sCFX_BRIDGE
    );

    const receipt2 = await contract
        .setShuiTreasury(process.env.SHUI_TREASURY)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt2, "sCFXBridge setShuiTreasury");
}
