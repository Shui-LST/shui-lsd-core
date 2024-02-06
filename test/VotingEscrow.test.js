const hre = require("hardhat");
const { expect, assert } = require("chai");
const { account } = require("../scripts/core/init");
const { ethers } = hre;
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const errorMessages = {
    initializeTwice: "Initializable: contract is already initialized",

    AlreadyLocked: "Governance: already locked",
    UnlockBlockTooClose: "Governance: unlock block too close",
    AmountMustBePositive: "Governance: amount must be positive",
    InsufficientBalance: "Governance: insufficient balance",
    ScfxAllowanceNotEnough: "sCFX allowance not enough",

    NotLocked: "Governance: not locked",
    NotUnlocked: "Governance: not unlocked",
    AlreadyUnlocked: "Governance: already unlocked",
    InvalidUnlockBlock: "Governance: invalid unlock block",
    OnlyOneVoteAllowed: "Only one vote is allowed",
    InvalidVoteRound: "Governance: invalid vote round",
    InsufficientVotePower: "Governance: insufficient vote power",
};

describe("EVotingEscrow", async function () {
    async function deployVotingEscrowFixtrue() {
        const ONE_DAY_BLOCK_NUMBER = 2 * 3600 * 24;
        const QUARTER_BLOCK_NUMBER = ONE_DAY_BLOCK_NUMBER * 365 / 4;
        const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
        const ONE_ROUND_BLOCK = ONE_DAY_BLOCK_NUMBER * 60;

        const accounts = await ethers.getSigners();

        const SCFX = await ethers.getContractFactory("MockScfx");
        const scfx = await SCFX.deploy();

        const MockCoreSpaceInfo = await ethers.getContractFactory("MockCoreSpaceInfo");
        const coreSpaceInfo = await MockCoreSpaceInfo.deploy();

        const VoingEscrow = await ethers.getContractFactory("DebugEVotingEscrow");
        const votingEscrow = await VoingEscrow.deploy();

        // let mappedsCFXBridge = accounts[9];
        await votingEscrow.initialize();
        await votingEscrow.setSCFX(scfx);
        // await votingEscrow.setMappedsCFXBridge(mappedsCFXBridge);
        await votingEscrow.setCoreSpaceInfo(coreSpaceInfo);

        return {
            accounts,
            // mappedsCFXBridge,
            coreSpaceInfo,
            votingEscrow,
            scfx,
            ONE_DAY_BLOCK_NUMBER,
            QUARTER_BLOCK_NUMBER,
            ONE_ROUND_BLOCK,
            ADDRESS_ZERO,
        };
    }

    async function createdLockFixtrue() {
        const result = await deployVotingEscrowFixtrue()
        const { scfx, accounts, votingEscrow, QUARTER_BLOCK_NUMBER } = result

        await scfx.mint(accounts[1], ethers.parseEther("1"))
        await scfx.connect(accounts[1]).approve(votingEscrow, ethers.parseEther("1"))

        const unlockBlock = BigInt(QUARTER_BLOCK_NUMBER + 100)
        await votingEscrow.connect(accounts[1]).createLock(ethers.parseEther("1"), unlockBlock)
        return {
            userUnlockBlock: QUARTER_BLOCK_NUMBER * 2,
            userLockAmount: ethers.parseEther("1"),
            ...result
        }
    }

    describe("initialize()", async () => {
        it("should initializate contract", async () => {
            expect(
                deployVotingEscrowFixtrue()
            ).to.be.not.rejected;
        });


        it("not allow double initialization", async () => {
            const { votingEscrow } = await deployVotingEscrowFixtrue();
            await expect(votingEscrow.initialize()).to.eventually.rejectedWith(
                errorMessages.initializeTwice
            );
        });
    });

    describe("createLock()", async () => {
        it("should create lock", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();

            await scfx.mint(accounts[1], ethers.parseEther("1"))
            await scfx.connect(accounts[1]).approve(votingEscrow, 100)

            const unlockBlock = BigInt(QUARTER_BLOCK_NUMBER + 100)
            await votingEscrow.connect(accounts[1]).createLock(100, unlockBlock)

            const realUnlockBlock = QUARTER_BLOCK_NUMBER * 2

            const expects = {
                stakedAmount: 100,
                lockInfoAmount: 100,
                lockInfoUnlockBlock: realUnlockBlock,
                globalLockAmount: 100
            }

            const stakedAmount = await votingEscrow.getStakedAmount(accounts[1])
            const userLockInfo = await votingEscrow.getUserLockInfo(accounts[1])
            const globalLockAmount = await votingEscrow.globalLockAmount(realUnlockBlock)

            expect(Number(stakedAmount)).to.be.equal(expects.stakedAmount)
            expect(Number(userLockInfo[0])).to.be.equal(expects.lockInfoAmount)
            expect(Number(userLockInfo[1])).to.be.equal(expects.lockInfoUnlockBlock)
            expect(Number(globalLockAmount)).to.be.equal(expects.globalLockAmount)
        })


        describe("should not create lock", async () => {
            it("should fail if user has locked", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await createdLockFixtrue();

                await expect(
                    votingEscrow.connect(accounts[1]).createLock(1, QUARTER_BLOCK_NUMBER + 100)
                ).to.be.rejectedWith(errorMessages.AlreadyLocked)
            })

            it("should fail if unlockBlock is small than one quater from now", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();
                await expect(
                    votingEscrow.createLock(1, 100)
                ).to.be.rejectedWith(errorMessages.UnlockBlockTooClose)
            })

            it("should fail if amount is 0", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();
                await expect(
                    votingEscrow.createLock(0, QUARTER_BLOCK_NUMBER + 100)
                ).to.be.rejectedWith(errorMessages.AmountMustBePositive)
            })

            it("should fail if user balance not enough", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();
                await expect(
                    votingEscrow.createLock(1, QUARTER_BLOCK_NUMBER + 100)
                ).to.be.rejectedWith(errorMessages.InsufficientBalance)
            })

            it("should fail if user allowance not enough", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();

                await scfx.mint(accounts[1], ethers.parseEther("1"))
                await expect(
                    votingEscrow.connect(accounts[1]).createLock(1, QUARTER_BLOCK_NUMBER + 100)
                ).to.be.rejectedWith(errorMessages.ScfxAllowanceNotEnough)
            })
        })
    })

    describe("increaseLock()", async () => {
        it("should increaseLock", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userLockAmount, userUnlockBlock } = await createdLockFixtrue();

            await scfx.mint(accounts[1], ethers.parseEther("1"))
            await scfx.connect(accounts[1]).approve(votingEscrow, ethers.parseEther("1"))

            await votingEscrow.connect(accounts[1]).increaseLock(ethers.parseEther("1"))

            const expects = {
                stakedAmount: 2e18,
                lockInfoAmount: 2e18,
                lockInfoUnlockBlock: userUnlockBlock,
                globalLockAmount: 2e18
            }

            const stakedAmount = await votingEscrow.getStakedAmount(accounts[1])
            const userLockInfo = await votingEscrow.getUserLockInfo(accounts[1])
            const globalLockAmount = await votingEscrow.globalLockAmount(userUnlockBlock)

            expect(Number(stakedAmount)).to.be.equal(expects.stakedAmount)
            expect(Number(userLockInfo[0])).to.be.equal(expects.lockInfoAmount)
            expect(Number(userLockInfo[1])).to.be.equal(expects.lockInfoUnlockBlock)
            expect(Number(globalLockAmount)).to.be.equal(expects.globalLockAmount)
        })

        describe("should not increase lock", async () => {
            it("should fail if user has not create lock", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();

                await expect(
                    votingEscrow.connect(accounts[1]).increaseLock(1)
                ).to.be.rejectedWith(errorMessages.NotLocked)
            })

            it("should fail if already unlocked", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                await coreSpaceInfo.setBlockNumber(userUnlockBlock)

                await expect(
                    votingEscrow.connect(accounts[1]).increaseLock(1)
                ).to.be.rejectedWith(errorMessages.AlreadyUnlocked)
            })

            it("should fail if amount is 0", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await createdLockFixtrue();
                await expect(
                    votingEscrow.connect(accounts[1]).increaseLock(0)
                ).to.be.rejectedWith(errorMessages.AmountMustBePositive)
            })

            it("should fail if user balance not enough", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await createdLockFixtrue();
                await expect(
                    votingEscrow.connect(accounts[1]).increaseLock(1)
                ).to.be.rejectedWith(errorMessages.InsufficientBalance)
            })

            it("should fail if user allowance not enough", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await createdLockFixtrue();

                await scfx.mint(accounts[1], ethers.parseEther("1"))
                await expect(
                    votingEscrow.connect(accounts[1]).increaseLock(1)
                ).to.be.rejectedWith(errorMessages.ScfxAllowanceNotEnough)
            })
        })
    })

    describe("extendLockTime()", async () => {
        it("should extendLockTime", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userLockAmount, userUnlockBlock } = await createdLockFixtrue();

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 2 + 100)

            const expects = {
                stakedAmount: 1e18,
                lockInfoAmount: 1e18,
                lockInfoUnlockBlock: QUARTER_BLOCK_NUMBER * 3,
                globalLockAmount: 1e18
            }

            const stakedAmount = await votingEscrow.getStakedAmount(accounts[1])
            const userLockInfo = await votingEscrow.getUserLockInfo(accounts[1])
            const globalLockAmount = await votingEscrow.globalLockAmount(QUARTER_BLOCK_NUMBER * 3)

            expect(Number(stakedAmount)).to.be.equal(expects.stakedAmount)
            expect(Number(userLockInfo[0])).to.be.equal(expects.lockInfoAmount)
            expect(Number(userLockInfo[1])).to.be.equal(expects.lockInfoUnlockBlock)
            expect(Number(globalLockAmount)).to.be.equal(expects.globalLockAmount)
        })

        describe("should not increase lock", async () => {
            it("should fail if user has not create lock", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER } = await deployVotingEscrowFixtrue();

                await expect(
                    votingEscrow.connect(accounts[1]).extendLockTime(1)
                ).to.be.rejectedWith(errorMessages.NotLocked)
            })

            it("should fail if already unlocked", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                await coreSpaceInfo.setBlockNumber(userUnlockBlock)

                await expect(
                    votingEscrow.connect(accounts[1]).extendLockTime(1)
                ).to.be.rejectedWith(errorMessages.AlreadyUnlocked)
            })

            it("should fail if unlockBluck small than old", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                await expect(
                    votingEscrow.connect(accounts[1]).extendLockTime(1)
                ).to.be.rejectedWith(errorMessages.InvalidUnlockBlock)
            })
        })
    })

    describe("withdraw()", async () => {
        it("should withdraw", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

            await coreSpaceInfo.setBlockNumber(userUnlockBlock)

            await votingEscrow.connect(accounts[1]).withdraw(ethers.parseEther("1"))

            const expects = {
                stakedAmount: 0,
                lockInfoAmount: 0,
                lockInfoUnlockBlock: userUnlockBlock,
                globalLockAmount: 0
            }

            const stakedAmount = await votingEscrow.getStakedAmount(accounts[1])
            const userLockInfo = await votingEscrow.getUserLockInfo(accounts[1])
            const globalLockAmount = await votingEscrow.globalLockAmount(userUnlockBlock)

            expect(Number(stakedAmount)).to.be.equal(expects.stakedAmount)
            expect(Number(userLockInfo[0])).to.be.equal(expects.lockInfoAmount)
            expect(Number(userLockInfo[1])).to.be.equal(expects.lockInfoUnlockBlock)
            expect(Number(globalLockAmount)).to.be.equal(expects.globalLockAmount)
        })

        describe("should not withdraw", async () => {
            it("should fail if user has not create lock", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                await coreSpaceInfo.setBlockNumber(userUnlockBlock - 1)

                await expect(
                    votingEscrow.connect(accounts[1]).withdraw(1)
                ).to.be.rejectedWith(errorMessages.NotUn)
            })

            it("should fail if already unlocked", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                await coreSpaceInfo.setBlockNumber(userUnlockBlock)

                await expect(
                    votingEscrow.connect(accounts[1]).withdraw(ethers.parseEther("2"))
                ).to.be.rejectedWith(errorMessages.InsufficientBalance)
            })
        })
    })

    describe("userVotePower()", async function () {
        it("should return correct", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            var votePower = await votingEscrow.userVotePower(accounts[1])
            // peroid is 1, because unlock block is 2 quoater and core block number is 1, so it is only 0.25 weight
            expect(votePower).to.be.equal(userLockAmount / 4n)

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 3)

            var votePower = await votingEscrow.userVotePower(accounts[1])
            expect(votePower).to.be.equal(userLockAmount / 2n)

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 4)

            var votePower = await votingEscrow.userVotePower(accounts[1])
            expect(votePower).to.be.equal(userLockAmount / 2n)

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 5)

            var votePower = await votingEscrow.userVotePower(accounts[1])
            expect(votePower).to.be.equal(userLockAmount)
        })

        it("should return correct2", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_ROUND_BLOCK, ONE_DAY_BLOCK_NUMBER, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 5)

            var acc1VotePower = await votingEscrow.userVotePower(accounts[1])
            expect(acc1VotePower).to.be.equal(userLockAmount)

            // after 3 month, the account1 vote pwoer is 1/2
            await coreSpaceInfo.setBlockNumber(QUARTER_BLOCK_NUMBER + 1)

            var acc1VotePower = await votingEscrow.userVotePower(accounts[1])
            expect(acc1VotePower).to.be.equal(userLockAmount / 2n)
        })
    })

    describe("userVotePower2", async function () {
        it("should return correct", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 5)

            var votePower = await votingEscrow.userVotePower(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(QUARTER_BLOCK_NUMBER * 5))
            expect(votePower).to.be.equal(0)

            var votePower = await votingEscrow.userVotePower(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(QUARTER_BLOCK_NUMBER * 4))
            expect(votePower).to.be.equal(userLockAmount / 4n)

            var votePower = await votingEscrow.userVotePower(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(QUARTER_BLOCK_NUMBER * 3))
            expect(votePower).to.be.equal(userLockAmount / 2n)

            var votePower = await votingEscrow.userVotePower(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(QUARTER_BLOCK_NUMBER * 2))
            expect(votePower).to.be.equal(userLockAmount / 2n)

            var votePower = await votingEscrow.userVotePower(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(QUARTER_BLOCK_NUMBER))
            expect(votePower).to.be.equal(userLockAmount)
        })
    })


    describe("castVoet()", async function () {
        describe("should cast vote", async () => {
            it("should castVote", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, userUnlockBlock } = await createdLockFixtrue();

                const round = 1
                const topic = 2
                const votePower = 3

                await votingEscrow.connect(accounts[1]).castVote(round, topic, [votePower, 0, 0])

                const userVoteInfo = await votingEscrow.getUserVoteInfo(round, accounts[1], topic, 0)
                const poolVoteInfo = await votingEscrow.getPoolVoteInfo(round, topic)
                const userVoteMeta = await votingEscrow.getUserVoteMeta(round, accounts[1], topic)
                const specialVotersLen = await votingEscrow.getTopicSpecialVotersLength(round, topic)

                expect(Number(userVoteInfo)).to.be.equal(votePower)
                expect(Number(poolVoteInfo[0])).to.be.equal(votePower)
                // expect(Number(userVoteMeta[0])).to.be.equal(votePower)
                expect(Number(specialVotersLen)).to.be.equal(0)
            })

            it("should update add speicialVoter when user locked large than one quater", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

                const network = await ethers.provider.getNetwork()
                console.log("chainId", network.chainId)

                // vote power weight is 1
                await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 5)
                // current vote power is 1, but end of round will be 1/2, it should set TopicSpecialVoters
                await coreSpaceInfo.setBlockNumber(ONE_ROUND_BLOCK + 1)
                await coreSpaceInfo.setCurrentVoteRound(2)

                const currentRoundEndBlock = await votingEscrow.currentRoundEndBlock()
                expect(currentRoundEndBlock).to.be.equal(BigInt(ONE_ROUND_BLOCK * 2))

                const round = 2
                const topic = 2
                const votePower = userLockAmount

                await votingEscrow.connect(accounts[1]).castVote(round, topic, [votePower, 0, 0])

                const userVoteInfo = await votingEscrow.getUserVoteInfo(round, accounts[1], topic, 0)
                const poolVoteInfo = await votingEscrow.getPoolVoteInfo(round, topic)
                const userVoteMeta = await votingEscrow.getUserVoteMeta(round, accounts[1], topic)
                const specialVotersLen = await votingEscrow.getTopicSpecialVotersLength(round, topic)

                expect(userVoteInfo).to.be.equal(votePower)
                expect(poolVoteInfo[0]).to.be.equal(votePower)
                // expect(Number(userVoteMeta[0])).to.be.equal(votePower)
                expect(Number(specialVotersLen)).to.be.equal(1)
            })

            it("should update infos by topicSpecialVoters", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

                const network = await ethers.provider.getNetwork()
                console.log("chainId", network.chainId)

                // vote power weight is 1
                await votingEscrow.connect(accounts[1]).extendLockTime(QUARTER_BLOCK_NUMBER * 5)
                // current vote power is 1, but end of round will be 1/2, it should set TopicSpecialVoters
                await coreSpaceInfo.setBlockNumber(ONE_ROUND_BLOCK + 1)
                await coreSpaceInfo.setCurrentVoteRound(2)


                const round = 2
                const topic = 2
                const acc1Vote = userLockAmount
                await votingEscrow.connect(accounts[1]).castVote(round, topic, [acc1Vote, 0, 0])

                // after one quarter, the account1 vote pwoer is 1/2
                await coreSpaceInfo.setBlockNumber(QUARTER_BLOCK_NUMBER + 1)

                const acc1VotePower = await votingEscrow.userVotePower(accounts[1])
                expect(acc1VotePower).to.be.equal(userLockAmount / 2n)

                // it will update poolinfo and accounts1 userVoteInfo when other people castVote
                const acc2Vote = ethers.parseEther("1")
                await scfx.mint(accounts[2], acc2Vote)
                await scfx.connect(accounts[2]).approve(votingEscrow, acc2Vote)
                await votingEscrow.connect(accounts[2]).createLock(acc2Vote, QUARTER_BLOCK_NUMBER * 6)
                await votingEscrow.connect(accounts[2]).castVote(round, topic, [acc2Vote, 0, 0])

                const userVoteInfo = await votingEscrow.getUserVoteInfo(round, accounts[1], topic, 0)
                const poolVoteInfo = await votingEscrow.getPoolVoteInfo(round, topic)
                const userVoteMeta = await votingEscrow.getUserVoteMeta(round, accounts[1], topic)
                const specialVotersLen = await votingEscrow.getTopicSpecialVotersLength(round, topic)

                expect(userVoteInfo).to.be.equal(acc1Vote / 2n)
                expect(poolVoteInfo[0]).to.be.equal(acc1Vote / 2n + acc2Vote)
                // expect(userVoteMeta[0]).to.be.equal(acc1Vote / 2n)
                expect(specialVotersLen).to.be.equal(1n)
            })
        })

        describe("should not cast vote", async () => {
            it("should fail if multi vote options", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();
                await expect(
                    votingEscrow.connect(accounts[1]).castVote(1, 2, [3, 4, 0])
                ).to.be.rejectedWith(errorMessages.OnlyOneVoteAllowed);
            })

            it("should fail if invalid vote round", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();
                await expect(
                    votingEscrow.connect(accounts[1]).castVote(2, 2, [3, 0, 0])
                ).to.be.rejectedWith(errorMessages.InvalidVoteRound);
            })

            it("should fail if insufficient vote power", async () => {
                const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();
                await expect(
                    votingEscrow.connect(accounts[1]).castVote(1, 2, [userLockAmount * 2n, 0, 0])
                ).to.be.rejectedWith(errorMessages.InsufficientVotePower);
            })
        })
    })

    describe("userStakableAmount()", async function () {
        it("should return correct", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            await scfx.mint(accounts[1], ethers.parseEther("1"))
            const amount = await votingEscrow.userStakableAmount(accounts[1])

            expect(amount).to.be.equal(ethers.parseEther("1"))
        })
    })

    describe("userLockInfo()", async function () {
        it("should return correct", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            const lockInfo = await votingEscrow.userLockInfo(accounts[1])

            expect(lockInfo[0]).to.be.equal(userLockAmount)
            expect(lockInfo[1]).to.be.equal(userUnlockBlock)
        })
    })

    describe("userLockInfo2", async function () {
        it("should return correct", async () => {
            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            var lockInfo = await votingEscrow.userLockInfo(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(0))

            expect(lockInfo[0]).to.be.equal(userLockAmount)
            expect(lockInfo[1]).to.be.equal(userUnlockBlock)

            var lockInfo = await votingEscrow.userLockInfo(ethers.Typed.address(accounts[1]), ethers.Typed.uint256(userUnlockBlock + 1))

            expect(lockInfo[0]).to.be.equal(0n)
            expect(lockInfo[1]).to.be.equal(0n)
        })
    })

    describe("readVote()", async function () {
        it("should return vote info2", async () => {

            const { votingEscrow, scfx, accounts, coreSpaceInfo, QUARTER_BLOCK_NUMBER, ONE_DAY_BLOCK_NUMBER, ONE_ROUND_BLOCK, userUnlockBlock, userLockAmount } = await createdLockFixtrue();

            await votingEscrow.connect(accounts[1]).castVote(1, 2, [3, 0, 0])

            const vote = await votingEscrow.readVote(accounts[1], 2)
            expect(vote[0]).to.be.equal(2n)
            expect(vote[1][0]).to.be.equal(3n)
            expect(vote[1][1]).to.be.equal(0n)
            expect(vote[1][2]).to.be.equal(0n)
        })
    })
})