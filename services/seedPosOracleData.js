const { conflux, account } = require("../scripts/core/init.js");
const { format } = require("js-conflux-sdk");
const {
    abi,
    bytecode,
} = require("../artifacts/contracts/core/PoSOracle.sol/PoSOracle.json"); // this is hardhat compile output

const oracle = conflux.Contract({
    abi,
    address: process.env.POS_ORACLE,
});

const { POS_POOL, POS_POOL_POS_ACCOUNT } = process.env;

async function main() {
    setInterval(async function () {
        await updatePosRewardInfo();
    }, 1000 * 60 * 15.1); // 15.1 minutes

    setInterval(async function () {
        await updateUserVotes();
    }, 1000 * 60 * 10.3); // 10.3 minutes

    console.log("Start POS Oracle service");
}

main().catch(console.log);

async function updatePosRewardInfo(epoch) {
    try {
        if (!epoch) {
            const status = await conflux.pos.getStatus();
            epoch = status.epoch - 1;
        }
        console.log(`Updating epoch ${epoch} reward info`);
        const rewardInfo = await conflux.pos.getRewardsByEpoch(epoch);
        if (!rewardInfo || !rewardInfo.accountRewards) return;
        const { accountRewards } = rewardInfo;
        let target = accountRewards.find(
            (r) => format.address(r.powAddress) === POS_POOL
        );
        if (!target) {
            console.log(`No reward info for ${POS_POOL}`);
            return;
        }
        const receipt = await oracle
            .updatePoSRewardInfo(
                epoch,
                target.powAddress,
                target.posAddress,
                target.reward
            )
            .sendTransaction({
                from: account.address,
            })
            .executed();
        console.log(new Date(), "updatePosRewardInfo:", receipt.outcomeStatus); // OP log
    } catch (e) {
        console.error("updatePosRewardInfo", e);
    }
}

async function updatePosAccountInfo() {
    try {
        const status = await conflux.pos.getStatus();
        const accountInfo = await conflux.pos.getAccount(POS_POOL_POS_ACCOUNT);
        if (!accountInfo) return;
        const {
            address,
            blockNumber,
            status: {
                inQueue,
                outQueue,
                locked,
                unlocked,
                availableVotes,
                forceRetired,
                forfeited,
            },
        } = accountInfo;
        const receipt = await oracle
            .updatePoSAccountInfo(
                address,
                status.epoch,
                blockNumber,
                availableVotes,
                unlocked,
                locked,
                forfeited,
                !!forceRetired,
                inQueue,
                outQueue
            )
            .sendTransaction({
                from: account.address,
            })
            .executed();

        console.log(new Date(), "updatePosAccountInfo:", receipt.outcomeStatus); // OP log
    } catch (e) {
        console.error("updatePosAccountInfo", e);
    }
}

async function updateUserVotes() {
    try {
        const status = await conflux.pos.getStatus();
        const accountInfo = await conflux.pos.getAccount(POS_POOL_POS_ACCOUNT);
        if (!accountInfo) return;
        const {
            status: { availableVotes },
        } = accountInfo;
        const receipt = await oracle
            .updateUserVotes(status.epoch, POS_POOL, availableVotes)
            .sendTransaction({
                from: account.address,
            })
            .executed();

        console.log(new Date(), "updateUserVotes:", receipt.outcomeStatus); // OP log
    } catch (e) {
        console.error("updateUserVotes failed", e);
    }
}
