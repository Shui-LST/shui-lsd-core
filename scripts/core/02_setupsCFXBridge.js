const hre = require("hardhat");
const { logReceipt } = require("./init");

main().catch(console.log);

async function main() {
    await setupsCFXBridge();
}

async function setupsCFXBridge() {
    const [account] = await hre.conflux.getSigners();

    let posPool = await conflux.getContractAt(
        "PoSPool",
        process.env.POS_POOL
    );

    const receipt1 = await posPool
        .setScfxBrdige(process.env.sCFX_BRIDGE)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt1, "PoSPool.setScfxBrdige");

    let contract = await conflux.getContractAt(
        "sCFXBridge",
        process.env.sCFX_BRIDGE
    );

    const receipt2 = await contract
        .setPoSPool(process.env.POS_POOL)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt2, "setPosPool");

    const receipt3 = await contract
        .setPoSOracle(process.env.POS_ORACLE)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt3, "setPoSOracle");

    const receipt4 = await contract
        .setESpacePool(process.env.sCFX)
        .sendTransaction({
            from: account.address,
        })
        .executed();
    logReceipt(receipt4, "setESpacePool");
}
