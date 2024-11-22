const { expect, use } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { encodeInitalizeWithData } = require("../scripts/util");
const { toBigInt } = require("ethers");
const { seconds } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time/duration");

const ONE_DAY = 24 * 3600;
const ONE_YEAR = 365 * ONE_DAY; // Number of seconds in a year
const PERIOD_YEAR = 100; // Lock period corresponding to 1 year


const errorMessages = {
    insufficientBalance: "ERC20: transfer amount exceeds balance",
    insufficientAllowance: "ERC20: insufficient allowance",
    invalidLockDuration: "Invalid lock period",
    noUnlockedShui: "No unlocked shui",
    alreadySettled: "Already settled for today",
    noReward: "No reward",
    onlyOwner: "Ownable: caller is not the owner",
    profitAwaitingIsZero: "Profit amount must be greater than 0",
    profitMustBeZeroWhenDayTotalVeshuiIsZero: "Profit must be 0 when dayTotalVeshui is 0"
};

describe("VeShui", async function () {

    async function deployShui(params) {
        const [owner, user1, user2] = await ethers.getSigners();

        // Deploy SHUI token
        const Shui = await ethers.getContractFactory("SHUI");
        // console.log("Ready to deploy shui token")
        const shuiLogic = await Shui.deploy(owner);
        // console.log(`SHUI logic deployed at: ${shuiLogic.target}`);

        const Proxy1967 = await ethers.getContractFactory("Proxy1967", owner)
        const shuiData = encodeInitalizeWithData(["address"], [owner.address])
        const shuiProxy = await Proxy1967.deploy(await shuiLogic.getAddress(), shuiData)
        await shuiProxy.waitForDeployment()
        // console.log(`SHUI deployed at: ${shuiProxy.target}`);

        const shui = await ethers.getContractAt("SHUI", shuiProxy.target)
        return shui
    }

    async function deployVeShuiFixture() {
        const [owner, user1, user2] = await ethers.getSigners();

        const shui = await deployShui()

        // Deploy VeShui contract
        const VeShui = await ethers.getContractFactory("veShui");
        const veShuiLogic = await VeShui.deploy();
        // console.log(`VeShui deployed at: ${veShui.target}`);

        const Proxy1967 = await ethers.getContractFactory("Proxy1967", owner)
        const veShuiData = encodeInitalizeWithData(["address"], [shui.target])
        const veShuiProxy = await Proxy1967.deploy(await veShuiLogic.getAddress(), veShuiData)
        await veShuiProxy.waitForDeployment()
        // // console.log(`SHUI deployed at: ${shuiProxy.target}`);

        const veShui = await ethers.getContractAt("veShui", veShuiProxy.target)
        // // console.log(`SHUI amount of owner: ${await shui.balanceOf(owner.address)}`);

        return {
            veShui,
            shui,
            owner,
            user1,
            user2
        };
    }

    async function deployVeShuiWithTokenFixture() {
        const fixture = await deployVeShuiFixture();
        const { owner, shui, user1, user2 } = fixture
        const amount = ethers.parseEther("1000");

        await shui.connect(owner).transfer(user1, amount);
        await shui.connect(owner).transfer(user2, amount);

        return {
            ...fixture
        };
    }

    async function user1LockFixtrue(params) {
        const { owner, veShui, shui, user1, user2 } = await deployVeShuiWithTokenFixture();
        // console.log(`deploy contract at ${await today()}`);

        const lockedAmount = ethers.parseEther("100");

        const user1LockPeroid = PERIOD_YEAR
        await shui.connect(user1).approve(veShui, lockedAmount);
        await veShui.connect(user1).lock(lockedAmount, user1LockPeroid);
        // console.log(`user1 lock at ${await today()}`);

        return {
            owner,
            veShui,
            shui,
            user1,
            lockedAmount,
            user1LockPeroid,
            user1VeShuiAmount: lockedAmount / 4n,
            user1UnlockDay: (await veShui.locks(0)).unlockDay,
        };
    }

    async function usersLockInSameDayFixture() {
        return multiUsersLockFixture(true);
    }

    async function usersLockInDiffDayFixture() {
        return multiUsersLockFixture(false);
    }

    async function multiUsersLockFixture(sameLockDay = false) {
        const { owner, veShui, shui, user1, user2 } = await deployVeShuiWithTokenFixture();
        // console.log(`deploy contract at ${await today()}`);

        const lockedAmount = ethers.parseEther("100");

        const user1LockPeroid = PERIOD_YEAR
        await shui.connect(user1).approve(veShui, lockedAmount);
        await veShui.connect(user1).lock(lockedAmount, user1LockPeroid);
        // console.log(`user1 lock at ${await today()}`);

        // console.log(`sameLockDay is ${sameLockDay}`);
        if (!sameLockDay) {
            // console.log("increase one day");
            await time.increase(ONE_DAY);
        }

        const user2LockPeroid = PERIOD_YEAR * 4
        await shui.connect(user2).approve(veShui, lockedAmount);
        await veShui.connect(user2).lock(lockedAmount, user2LockPeroid);
        // console.log(`user2 lock at ${await today()}`);

        return {
            owner,
            veShui,
            shui,
            user1,
            lockedAmount,
            user1LockPeroid,
            user2LockPeroid,
            user1VeShuiAmount: lockedAmount / 4n,
            user2VeShuiAmount: lockedAmount,
            user1UnlockDay: (await veShui.locks(0)).unlockDay,
            user2UnlockDay: (await veShui.locks(1)).unlockDay,
        };
    }

    async function today() {
        return Math.floor((await ethers.provider.getBlock("latest")).timestamp / ONE_DAY);
    }

    describe("Constant", function () {
        it("verify lock period constant", async function () {
            const { veShui } = await deployVeShuiFixture();
            expect(await veShui.PERIOD_YEAR()).to.equal(PERIOD_YEAR);
        });
    });

    describe("Deploy", function () {
        it("last settle day should be yesterday of deploy time", async function () {
            const { veShui } = await deployVeShuiFixture();
            expect(await veShui.lastSettleDay()).to.equal(await today());
        })
    })

    describe("Lock time calculation", function () {
        it("calculate lock time/unlock time", async function () {
            const { veShui, shui, user1 } = await deployVeShuiWithTokenFixture();
            const lockDuration = 50; // 0.5 year

            const lockTime = Math.floor((new Date().valueOf() / 1000))
            const lockDate = Math.floor(lockTime / ONE_DAY) + 1

            let unlockTime = lockTime + (lockDuration * ONE_YEAR / PERIOD_YEAR)
            let expectUnlockDay = Math.floor(unlockTime / ONE_DAY) + 1

            const actualLockDay = await veShui.calcLockDate(lockTime);
            const actualUnlockDay = await veShui.calcUnlockDate(lockTime, lockDuration);

            expect(actualLockDay.toString()).to.equal(lockDate.toString())
            expect(actualUnlockDay.toString()).to.equal(expectUnlockDay.toString())
        });
    })

    describe("Lock", function () {
        it("should user state correct after lock", async function () {
            const { owner, veShui, shui, user1 } = await deployVeShuiWithTokenFixture();
            const amount = ethers.parseEther("100");
            const lockDuration = 50; // 0.5 year

            await shui.connect(user1).approve(veShui, amount);
            await veShui.connect(user1).lock(amount, lockDuration);
            const expectLockDay = await today() + 1
            const expectUnlockDay = await today() + 183;

            // dayLocks should have value
            const dayLocks = await veShui.getDayLocks(expectLockDay);
            expect(dayLocks).to.have.lengthOf(1);

            const dayLockUsers = await veShui.getDayLockUsers(expectLockDay);
            expect(dayLockUsers).to.have.lengthOf(1);

            // dayUnlocks should have value
            const dayUnlocks = await veShui.getDayUnlocks(expectUnlockDay);
            expect(dayUnlocks.length).to.equal(1);

            const dayUnlockUsers = await veShui.getDayUnlockUsers(expectUnlockDay);
            expect(dayUnlockUsers.length).to.equal(1);

            let userInfo = await veShui.getUserInfoNow(user1.address);
            let [userLocks, reward, unlockedShui, userTotalVeShui] = userInfo
            expect(reward).to.equal(0);
            expect(unlockedShui).to.equal(0);
            expect(userTotalVeShui).to.equal(0);

            let [user, _amount, veShuiAmount, lockDay, unlockDay, isHandledUnlock, isHandledLock] = userLocks[0]
            expect(user).to.equal(user1.address);
            expect(veShuiAmount).to.equal(amount / 8n);
            expect(unlockDay).to.equal(expectUnlockDay);
            expect(isHandledUnlock).to.be.false;
            expect(isHandledLock).to.be.false;

            // After 1 day, userTotalVeShui should increase
            await time.increase(ONE_DAY);
            userInfo = await veShui.getUserInfoNow(user1.address);
            [userLocks, reward, unlockedShui, userTotalVeShui] = userInfo
            expect(reward).to.equal(0);
            expect(unlockedShui).to.equal(0);
            expect(userTotalVeShui).to.equal(amount / 8n);

            [user, _amount, veShuiAmount, lockDay, unlockDay, isHandledUnlock, isHandledLock] = userLocks[0]
            expect(user).to.equal(user1.address);
            expect(veShuiAmount).to.equal(amount / 8n);
            expect(unlockDay).to.equal(expectUnlockDay);
            expect(isHandledUnlock).to.be.false;
            expect(isHandledLock).to.be.false;

            // After distributing profit, isHandledLock should be true

            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.distributeProfit();
            userInfo = await veShui.getUserInfoNow(user1.address);
            [userLocks, reward, unlockedShui, userTotalVeShui] = userInfo
            // console.log("userInfo", userInfo)
            // console.log("userlocks[0]", userLocks[0])
            // console.log("isHandledUnlock", isHandledUnlock)

            isHandledLock = userLocks[0][6]
            expect(isHandledLock).to.be.true;
        })

        it("should fail if insufficient veshui balance", async function () {
            const { shui, veShui, user1 } = await deployVeShuiFixture();
            const amount = ethers.parseEther("100");
            const lockDuration = PERIOD_YEAR; // 1 year

            await shui.connect(user1).approve(veShui, amount);

            await expect(
                veShui.connect(user1).lock(amount, lockDuration)
            ).to.be.revertedWith(errorMessages.insufficientBalance);
        });

        it("should fail if not approve", async function () {
            const { veShui, user1 } = await deployVeShuiWithTokenFixture();
            const amount = ethers.parseEther("100");
            const lockDuration = PERIOD_YEAR; // 1 year

            await expect(
                veShui.connect(user1).lock(amount, lockDuration)
            ).to.be.revertedWith(errorMessages.insufficientAllowance);
        });

        it("should fail if invalid lock duration", async function () {
            const { veShui, shui, user1 } = await deployVeShuiWithTokenFixture();
            const amount = ethers.parseEther("100");
            const lockDuration = 10; // Invalid lock duration

            await shui.connect(user1).approve(veShui, amount);

            await expect(
                veShui.connect(user1).lock(amount, lockDuration)
            ).to.be.revertedWith(errorMessages.invalidLockDuration);
        });
    });

    describe("Withdraw", function () {
        it("should withdraw unlocked success", async function () {
            const { owner, shui, veShui, user1, lockedAmount, user1UnlockDay } = await usersLockInDiffDayFixture();

            await time.increaseTo(user1UnlockDay * toBigInt(ONE_DAY) + 1n);

            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.distributeProfit();

            const userShuiBeforeWithdraw = await shui.balanceOf(user1.address);
            await veShui.connect(user1).withdraw();
            const userShuiWithdrawed = (await shui.balanceOf(user1.address) - userShuiBeforeWithdraw);

            expect(userShuiWithdrawed).to.equal(lockedAmount);
        });

        it("should failed if no unlocked shui", async function () {
            const { veShui, user1 } = await deployVeShuiFixture();
            await expect(
                veShui.connect(user1).withdraw()
            ).to.be.revertedWith(errorMessages.noUnlockedShui);
        });
    });

    describe("Summary", function () {
        it("should correct", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay } = await usersLockInDiffDayFixture();

            const profit = ethers.parseEther("1");

            // Fast forward to user1UnlockDay
            await time.increaseTo(user1UnlockDay * toBigInt(ONE_DAY) + 1n);
            await owner.sendTransaction({ value: profit, to: veShui.target });
            await veShui.distributeProfit();

            const summary = await veShui.summaryNow();
            const [usersLength, totalVeShui, totalLocked, accRewardPerVeShui, lastSettleDay, aprOnLastSeetleTime] = summary
            expect(usersLength).to.equal(2);
            expect(totalVeShui).to.equal(user2VeShuiAmount);
            expect(totalLocked).to.equal(lockedAmount);
            expect(accRewardPerVeShui).to.equal(8092896174863110n);
            expect(lastSettleDay).to.equal(user1UnlockDay);
            expect(aprOnLastSeetleTime).to.equal(9972680749304527n);
        })
    })

    // After successfully depositing CFX, check if expired locks are unlocked, if rewards are distributed correctly, if userInfos fields are correct, if expired locks are removed, if expired dates are removed from dayUnlocks
    describe("DistributeProfit", function () {
        it("should distribute profit success by anyone", async function () {
            const { veShui, owner, user1 } = await usersLockInSameDayFixture();

            await time.increase(ONE_DAY)
            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.connect(user1).distributeProfit();
        });

        it("should fail when profit is not 0 but totalVeShui is 0", async function () {
            const { veShui, owner, user1 } = await usersLockInSameDayFixture();
            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await expect(veShui.distributeProfit()).to.be.revertedWith(errorMessages.profitMustBeZeroWhenDayTotalVeshuiIsZero);
        });

        it("should distribute correct", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount } = await usersLockInDiffDayFixture();
            // const profit = ethers.parseEther("1");

            // Deposit on day 1, lock time is day 2 at 0:00, when distributing rewards after day 2 at 0:00, distribute till day 2.
            // Day 1 distribution: user1: 0.5
            // Day 2 distribution: user1: 0.5/5, user2: 0.5*4/5

            await time.increase(ONE_DAY);

            // deposit cfx
            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.distributeProfit();

            // 500/25 + 500/125 = 0.024
            await expect(veShui.accRewardPerVeShui()).to.eventually.equal(24n);

            // user1 rewards should be distributed correctly
            const user1Info = await veShui.getUserInfoNow(user1.address);
            const [user1Locks, reward, unlockedShui, _totalVeShui] = user1Info
            expect(user1Locks).to.have.lengthOf(1);
            expect(user1Locks[0][6]).to.be.true;
            expect(reward).to.equal(600n);
            expect(unlockedShui).to.equal(0);
            expect(_totalVeShui).to.equal(user1VeShuiAmount);
        });

        it("should delete unlocked locks", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay, user2UnlockDay } = await usersLockInDiffDayFixture();
            // console.log("user1UnlockDay is", user1UnlockDay);

            const profit = ethers.parseEther("1");

            // set time to one day after user1UnlockDay
            await time.increaseTo((user1UnlockDay) * toBigInt(ONE_DAY) + 1n);

            await expect(veShui.getDayUnlocks(user1UnlockDay)).to.eventually.have.lengthOf(1);
            await expect(veShui.getDayUnlockUsers(user1UnlockDay)).to.eventually.have.lengthOf(1);

            await owner.sendTransaction({ value: profit, to: veShui.target });
            await veShui.distributeProfit();

            await expect(veShui.getDayUnlocks(user1UnlockDay), "dayUnlocks should be empty").to.eventually.have.lengthOf(0);
            await expect(veShui.getDayUnlockUsers(user1UnlockDay), "dayUnlockUsers should be empty").to.eventually.have.lengthOf(0);
            await expect(veShui.locks(0), "lock should be deleted").to.eventually.be.reverted;
        });

        it("should work if depositProfit multi times one day", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay, user2UnlockDay } = await usersLockInSameDayFixture();

            await time.increase(ONE_DAY);

            const profit = 1000n
            await owner.sendTransaction({ value: profit, to: veShui.target });
            await veShui.distributeProfit();
            await expect(veShui.accRewardPerVeShui()).to.eventually.equal(1000n * ethers.parseEther("1") / (user1VeShuiAmount + user2VeShuiAmount));
            // 收益分配正确
            await owner.sendTransaction({ value: profit, to: veShui.target });
            await veShui.distributeProfit();
            await expect(veShui.accRewardPerVeShui()).to.eventually.equal(2000n * ethers.parseEther("1") / (user1VeShuiAmount + user2VeShuiAmount));

        });

        it("should failed if profitAwaiting is 0", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay, user2UnlockDay } = await usersLockInDiffDayFixture();
            await expect(veShui.distributeProfit()).to.be.revertedWith(errorMessages.profitAwaitingIsZero);
        });

        it("should work if user locks num > 100 on same day", async function () {
            const { veShui, shui, owner, user1} = await deployVeShuiWithTokenFixture();
            const lockedAmount = 100n;

            for (let i = 0; i < 100; i++) {
                const user1LockPeroid = PERIOD_YEAR
                await shui.connect(user1).approve(veShui, lockedAmount);
                await veShui.connect(user1).lock(lockedAmount, user1LockPeroid);
            }

            await time.increase(ONE_DAY);
            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.distributeProfit();
        });
    });

    describe("Claim", function () {
        it("Should claim success", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay, user2UnlockDay } = await usersLockInSameDayFixture();

            await time.increase(ONE_DAY);

            await owner.sendTransaction({ value: 1000n, to: veShui.target });
            await veShui.distributeProfit();

            const cfxBeforeClaim = await ethers.provider.getBalance(user1.address);
            const tx = await veShui.connect(user1).claim();
            const receipt = await tx.wait();
            const gas = receipt.gasUsed * receipt.gasPrice;
            const cfxAfterClaim = await ethers.provider.getBalance(user1.address);

            expect(cfxAfterClaim + gas - cfxBeforeClaim).to.equal(200n);
        });

        it("Should fail if no reward", async function () {
            const { veShui, shui, owner, user1, lockedAmount, user1VeShuiAmount, user2VeShuiAmount, user1UnlockDay, user2UnlockDay } = await usersLockInSameDayFixture();
            await expect(
                veShui.connect(user1).claim()
            ).to.be.revertedWith(errorMessages.noReward);
        });
    });

    describe("CalculateVeShui", function () {
        it("should calculate veShui correct", async function () {
            const { veShui } = await deployVeShuiFixture();
            const amount = ethers.parseEther("100");

            let lockDuration = 50; // 0.5 year
            let veShuiAmount = await veShui.calculateVeShui(amount, lockDuration);
            expect(veShuiAmount).to.equal(amount / 8n);

            lockDuration = 100; // 1 year
            veShuiAmount = await veShui.calculateVeShui(amount, lockDuration);
            expect(veShuiAmount).to.equal(amount / 4n);

            lockDuration = 200; // 2 years
            veShuiAmount = await veShui.calculateVeShui(amount, lockDuration);
            expect(veShuiAmount).to.equal(amount / 2n);

            lockDuration = 400; // 4 years
            veShuiAmount = await veShui.calculateVeShui(amount, lockDuration);
            expect(veShuiAmount).to.equal(amount);
        })

        it("should fail if invalid lock duration", async function () {
            const { veShui } = await deployVeShuiFixture();
            const amount = ethers.parseEther("100");

            let lockDuration = 0; // 0 year
            await expect(veShui.calculateVeShui(amount, lockDuration)).to.be.revertedWith(errorMessages.invalidLockDuration);

            lockDuration = 150; // 1.5 years
            await expect(veShui.calculateVeShui(amount, lockDuration)).to.be.revertedWith(errorMessages.invalidLockDuration);

            lockDuration = 500; // 5 years
            await expect(veShui.calculateVeShui(amount, lockDuration)).to.be.revertedWith(errorMessages.invalidLockDuration);
        })
    })
});
