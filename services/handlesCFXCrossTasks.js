const { conflux, account, logReceipt } = require("../scripts/core/init.js");
const {
    abi,
    bytecode,
} = require("../artifacts/contracts/core/sCFXBridge.sol/sCFXBridge.json"); // this is hardhat compile output
const { Drip } = require("js-conflux-sdk");

const ONE_VOTE_CFX = BigInt(Drip.fromCFX(1000));
const { sCFX_BRIDGE } = process.env;

const scfxBridge = conflux.Contract({
    abi,
    address: sCFX_BRIDGE,
});

async function main() {
    setInterval(async () => {
        try {
            await handleCrossSpaceTask();
            await handleLockAndVote();
        } catch (e) {
            console.error("handleCrossSpaceTask error: ", e);
        }
    }, 1000 * 60 * 1);
}

main().catch(console.log);

async function handleCrossSpaceTask() {
    console.log(`Starting to run handleCrossSpaceTask...`);
    // step 1 Cross CFX from eSpace to Core
    const mappedBalance = await scfxBridge.mappedBalance();
    if (mappedBalance > 0) {
        const receipt = await scfxBridge
            .transferFromEspace()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt, "Cross CFX from eSpace to Core");
    }

    // step2 Claim interest
    const interest = await scfxBridge.poolInterest();
    if (interest > 0) {
        const receipt = await scfxBridge
            .claimInterest()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt, "Claim interest");
    }

    // step3 Handle redeem
    const redeemLen = await scfxBridge.eSpaceRedeemLen();
    if (redeemLen > 0) {
        let summary = await scfxBridge.poolSummary();

        if (summary.unlocked > 0) {
            await _handleRedeem(); // do withdraw
            // update summary
            summary = await scfxBridge.poolSummary();
        }

        let balance = await conflux.cfx.getBalance(sCFX_BRIDGE);
        let unlocking = summary.votes - summary.available - summary.unlocked;
        let totalNeedRedeem = await scfxBridge.eSpacePoolTotalClaimed();
        if (
            summary.locked > 0 &&
            balance + unlocking * ONE_VOTE_CFX < totalNeedRedeem
        ) {
            await _handleRedeem(); // do unlock
        }

        if (balance >= totalNeedRedeem) {
            await _handleRedeem(); // handle redeem
        }
    } else {
        let summary = await scfxBridge.poolSummary();
        if (summary.unlocked > 0) {
            await _handleRedeem(); // do withdraw
            // update summary
            summary = await scfxBridge.poolSummary();
        }
        // do unstake when no redeem task to refund liquid pool
        let balance = await conflux.cfx.getBalance(sCFX_BRIDGE);
        let accInterest = await scfxBridge.poolAccInterest();
        if (accInterest > balance) {
            let unlocking =
                summary.votes - summary.available - summary.unlocked;
            if (accInterest > balance + unlocking * ONE_VOTE_CFX) {
                let toUnlock = accInterest - balance - unlocking * ONE_VOTE_CFX;
                let toUnlockVote = toUnlock / ONE_VOTE_CFX;
                if (toUnlock > toUnlockVote * ONE_VOTE_CFX) toUnlockVote += 1n;
                if (toUnlockVote > 0) {
                    const receipt = await scfxBridge
                        .unstakeVotes(toUnlockVote)
                        .sendTransaction({
                            from: account.address,
                        })
                        .executed();
                    logReceipt(receipt, "Unstake votes");
                }
            }
        }
    }

    // step4 Stake votes
    const stakeableBalance = await scfxBridge.stakeableBalance();
    if (stakeableBalance > ONE_VOTE_CFX) {
        const receipt = await scfxBridge
            .stakeVotes()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt, "Stake votes");
    }
}

async function _handleRedeem() {
    try {
        const receipt = await scfxBridge
            .handleRedeem()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt, "Handle redeem");
    } catch (error) {
        console.error("Handle redeem error: ", error);
    }
}

async function handleLockAndVote() {
    const isLockChanged = await scfxBridge.isLockInfoChanged();
    if (isLockChanged) {
        const receipt = await scfxBridge
            .syncLockInfo()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt, "Update lock info");
    }

    const isVoteChanged = await scfxBridge.isVoteInfoChanged();
    if (isVoteChanged) {
        const receipt2 = await scfxBridge
            .syncVoteInfo()
            .sendTransaction({
                from: account.address,
            })
            .executed();
        logReceipt(receipt2, "Update vote info");
    }
}
