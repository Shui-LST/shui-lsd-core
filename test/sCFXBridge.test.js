const hre = require("hardhat");
const { expect, assert } = require("chai");
const { ethers } = hre;

const errorMessages = {
    initializeTwice: "Initializable: contract is already initialized",
    poolRegistered: "Pool is already registed",
    onlybridge: "Only scfxBridge can call this function",
    onlyRegisted: "Pool is not registed",
    onlyOwner: "Ownable: caller is not the owner",
    registerVP: "votePower should be 1",
    registerMsgValue: "msg.value should be 1000 CFX",
    noClaimableInterest: "No claimable interest",
    increaseStakeMinVotePower: "Minimal votePower is 1",
    increaseStakeMsgValue: "msg.value should be votePower * 1000 ether",
    decreaseStakeLockedNotEnough: "Locked is not enough",
    withdrawStakeUnlockedNotEnough: "Unlocked is not enough",
    intrestNotEnough: "Interest not enough",
    ratioShouldBe1to10000: "ratio should be 1-10000",

    insufficientPoolInterest: "sCFXBridge: insufficient pool interest",
    insufficientBalance: "sCFXBridge: insufficient balance",
    insufficientVotes: "sCFXBridge: insufficient votes",
    notEnoughBalance: "Not enough balance",
};

describe("PoSPool", async function () {
    async function deployScfxBrdigeFixture() {
        const CFX_PER_VOTE = ethers.parseEther("1000");
        const ONE_DAY_BLOCK_COUNT = 2 * 3600 * 24;
        const ONE_YEAR_BLOCK_COUNT = ONE_DAY_BLOCK_COUNT * 365;
        const QUARTER_BLOCK_NUMBER = ONE_YEAR_BLOCK_COUNT / 4;
        const RATIO_BASE = 1000_000_000;

        const accounts = await ethers.getSigners();

        const MockParamsControl = await ethers.getContractFactory("MockParamsControl");
        const paramsControl = await MockParamsControl.deploy();

        const MockCrossSpaceCall = await ethers.getContractFactory("MockCrossSpaceCall");
        const crossSpaceCall = await MockCrossSpaceCall.deploy();

        const MockScfx = await ethers.getContractFactory("MockScfx");
        const eScfx = await MockScfx.deploy();

        const MockPosPool = await ethers.getContractFactory("MockPosPool");
        const posPool = await MockPosPool.deploy();

        const MockPosOracle = await ethers.getContractFactory("MockPosOracle");
        const posOracle = await MockPosOracle.deploy();

        const MockVotingEscrow = await ethers.getContractFactory("MockVotingEscrow");
        const votingEscrow = await MockVotingEscrow.deploy();

        const sCFXBridge = await ethers.getContractFactory("DebugScfxBridge");
        const scfxBridge = await sCFXBridge.deploy();

        await scfxBridge.initialize(await crossSpaceCall.getAddress(), await paramsControl.getAddress());
        await scfxBridge.setESpacePool(eScfx);
        await scfxBridge.setPoSPool(posPool);
        await scfxBridge.setEspaceVotingEscrow(votingEscrow);
        await scfxBridge.setPoSOracle(posOracle);

        // set mock espace address of scfxBrdige
        const MockMappedAddress = await ethers.getContractFactory("MockMappedAddress");
        const bridgeMockMappedAddress = await MockMappedAddress.deploy(await scfxBridge.getAddress());
        await crossSpaceCall.setMockMapped(await scfxBridge.getAddress(), await bridgeMockMappedAddress.getAddress())

        // console.log(`deployed. paramsControl:${await paramsControl.getAddress()},crossSpaceCall:${await crossSpaceCall.getAddress()},scfxBridge:${await scfxBridge.getAddress()}`)

        return {
            accounts,
            scfxBridge,
            bridgeMockMappedAddress,
            eScfx,
            posPool,
            crossSpaceCall,
            paramsControl,
            votingEscrow,
            posOracle,
            CFX_PER_VOTE,
            ONE_YEAR_BLOCK_COUNT,
            QUARTER_BLOCK_NUMBER,
            RATIO_BASE,
        };
    }


    describe("Initialize()", async () => {
        it("should initializate contract", async () => {
            const { scfxBridge } = await deployScfxBrdigeFixture();
            const expectedValues = {
                aprPeriodCount: 48,
                poolShareRatio: 100_000_000,
                maxRedeemLenPerCall: 30
            }

            //check expected initial values
            expect(String(await scfxBridge.aprPeriodCount())).to.be.equal(
                expectedValues.aprPeriodCount.toString()
            );
        });

        describe("should not initializate contract in cases", function () {
            it("not allow double initialization", async () => {
                //pool already initialized
                const { scfxBridge } = await deployScfxBrdigeFixture();
                await expect(scfxBridge.initialize()).to.eventually.rejectedWith(
                    errorMessages.initializeTwice
                );
            });

            it("not allow initialization with non-valid parameters", async () => {
                const { scfxBridge } = await deployScfxBrdigeFixture();
                await expect(scfxBridge.initialize("non-valid-data")).to.eventually.rejected;
            });
        });
    });

    describe("setPoSOracle()", async () => {
        it("should set pos oracle", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setPoSOracle(accounts[1]);
            const posOracle = await scfxBridge.posOracle();

            expect(posOracle).to.be.equal(accounts[1].address)
        })

        it("should not set pos oracle if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).setPoSOracle(accounts[1])
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("setPoolShareRatio()", async () => {
        it("should set pool share ratio", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setPoolShareRatio(10);
            const poolShareRatio = await scfxBridge.poolShareRatio();

            expect(String(poolShareRatio)).to.be.equal("10")
        })

        it("should not set pool share ratio if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).setPoolShareRatio(10)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("eSpaceVotingEscrow()", async () => {
        it("should set espace_voting_escrow address", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setEspaceVotingEscrow(accounts[1]);
            const eVotingEscrow = await scfxBridge.eSpaceVotingEscrow();

            expect(String(eVotingEscrow)).to.be.equal(accounts[1].address)
        })

        it("should not set espace_voting_escrow if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).setEspaceVotingEscrow(accounts[1].address)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("setPoSPool()", async () => {
        it("should set pos pool address", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setPoSPool(accounts[1]);
            const posPoolAddr = await scfxBridge.posPoolAddr();

            expect(String(posPoolAddr)).to.be.equal(accounts[1].address)
        })

        it("should not set pos pool address if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).setPoSPool(accounts[1].address)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("setESpacePool()", async () => {
        it("should set sCfx address", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setESpacePool(accounts[1]);
            const sCFXAddr = await scfxBridge.sCFXAddr();

            expect(String(sCFXAddr)).to.be.equal(accounts[1].address)
        })

        it("should not set sCfx address if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).setESpacePool(accounts[1].address)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    // describe("depositPoolInterest()", async () => {
    //     it("should set sCfx address", async () => {
    //         const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

    //         await scfxBridge.depositPoolInterest({ value: ethers.parseEther("1") });
    //         const poolAccIntrest = await scfxBridge.poolAccInterest();

    //         expect(Number(poolAccIntrest)).to.be.equal(1e18)
    //     })

    //     it("should not set sCfx address if not owner", async () => {
    //         const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

    //         await expect(
    //             scfxBridge.connect(accounts[1]).depositPoolInterest({ value: ethers.parseEther("1") })
    //         ).to.rejectedWith(errorMessages.onlyOwner);
    //     })
    // });

    describe("withdrawPoolInterest()", async () => {
        it("should withdraw pool interest", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await scfxBridge.setPoolAccInterest(ethers.parseEther("1"), { value: ethers.parseEther("1") });

            await scfxBridge.withdrawPoolInterest(ethers.parseEther("0.1"));
            const poolAccIntrest = await scfxBridge.poolAccInterest();

            expect(Number(poolAccIntrest)).to.be.equal(9e17)
        })

        it("should not withdraw pool interest if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).withdrawPoolInterest(0)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })

        it("should not withdraw pool interest exceed poolAccInterest", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.withdrawPoolInterest(1)
            ).to.rejectedWith(errorMessages.insufficientPoolInterest);
        })

        it("should not withdraw pool interest exceed balance", async () => {
            const { accounts, crossSpaceCall, scfxBridge } = await deployScfxBrdigeFixture();


            // set mock espace address of scfxBrdige
            const MockMappedAddress = await ethers.getContractFactory("MockMappedAddress");
            const mockMappedAddress = await MockMappedAddress.deploy(await scfxBridge.getAddress());

            await crossSpaceCall.setMockMapped(await scfxBridge.getAddress(), await mockMappedAddress.getAddress())

            // deposit
            await scfxBridge.setPoolAccInterest(ethers.parseEther("1"));
            // transfer to espace
            // await scfxBridge.transferToEspacePool()

            await expect(
                scfxBridge.withdrawPoolInterest(1)
            ).to.rejectedWith(errorMessages.insufficientBalance);
        })
    });

    describe("stakeableBalance()", async () => {
        describe("should return stakeableBalance", async () => {
            it("should return stakeableBalance if balance greater than both poolAccInterest and _needRedeem", async () => {
                const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

                await scfxBridge.setPoolAccInterest(ethers.parseEther("1"), { value: ethers.parseEther("1") })
                await accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("1") })

                const stakeableBalance = await scfxBridge.stakeableBalance()
                expect(Number(stakeableBalance)).to.be.equal(1e18)
            })

            it("should return 0 if balance equal than poolAccInterest", async () => {
                const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

                await scfxBridge.setPoolAccInterest(ethers.parseEther("1"), { value: ethers.parseEther("1") })

                const stakeableBalance = await scfxBridge.stakeableBalance()
                expect(Number(stakeableBalance)).to.be.equal(0)
            })

            it("should return 0 if balance equal than _needRedeem", async () => {
                const { accounts, eScfx, scfxBridge } = await deployScfxBrdigeFixture();

                await accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("1000") })

                await eScfx.setTotalClaimed(ethers.parseEther("1000"))

                const stakeableBalance = await scfxBridge.stakeableBalance()
                expect(Number(stakeableBalance)).to.be.equal(0)
            })
        })
    });

    describe("poolPeriodRewardRate()", async () => {
        it("should return 0 when epoch is small than peroid", async () => {
            const { accounts, RATIO_BASE, scfxBridge, posPool, posOracle } = await deployScfxBrdigeFixture()

            await posOracle.setposEpochHeight(47)
            var rate = await scfxBridge.poolPeriodRewardRate()
            expect(Number(rate)).to.be.equal(0)

            await posOracle.setposEpochHeight(0)
            var rate = await scfxBridge.poolPeriodRewardRate()
            expect(Number(rate)).to.be.equal(0)
        })

        it("should return 0 when total user votes is 0", async () => {
            const { accounts, RATIO_BASE, scfxBridge, posPool, posOracle } = await deployScfxBrdigeFixture()

            await posOracle.setposEpochHeight(100)
            const rate = await scfxBridge.poolPeriodRewardRate()

            expect(Number(rate)).to.be.equal(0)
        })

        it("should return period reward rate", async () => {
            const { accounts, RATIO_BASE, CFX_PER_VOTE, scfxBridge, posPool, posOracle } = await deployScfxBrdigeFixture()

            await posOracle.setposEpochHeight(100)
            await posOracle.setUserVotes(99, posPool, 1)
            await posOracle.setUserPoSReward(99, posPool, ethers.parseEther("1"))

            const rate = await scfxBridge.poolPeriodRewardRate()
            expect(Number(rate)).to.be.equal(ethers.parseEther("1") * BigInt(RATIO_BASE) / BigInt(CFX_PER_VOTE))
        })

    });

    describe("claimInterest()", async () => {
        it("should claimInterest if interest is 0", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture()

            await scfxBridge.claimInterest()

            const poolAccIntrest = await scfxBridge.poolAccInterest()
            expect(Number(poolAccIntrest)).to.be.equal(0)
        });

        it("should claimInterest if interest is not 0", async () => {
            const { accounts, eScfx, posPool, scfxBridge } = await deployScfxBrdigeFixture();

            await posPool.depositUserIntrest(scfxBridge, { value: ethers.parseEther("1") })

            await scfxBridge.claimInterest()

            const poolAccIntrest = await scfxBridge.poolAccInterest()
            expect(Number(poolAccIntrest)).to.be.equal(1e17)
        });

        it("should not claimInterest if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).claimInterest()
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("stakeVotes()", async () => {
        describe("should stake votes", async () => {
            it("should stake votes when 'balance - (needRedeem + poolAccInterest)' not less than 1 vote ", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()

                // transfer 3000 eth
                await accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("3000") })
                // set needRedeem to 1000 eth and poolAccInterest to 1eth
                await eScfx.setTotalClaimed(ethers.parseEther("1000"))
                await scfxBridge.setPoolAccInterest(ethers.parseEther("1"), { value: ethers.parseEther("1") })

                expect(scfxBridge.stakeVotes()).to.emit(posPool, "EventIncreaseStake");
            })

            it("should return if balance not more than needRedeem", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()
                expect(scfxBridge.stakeVotes()).to.not.emit(posPool, "EventIncreaseStake");
            })

            it("should return if balance not more than poolAccInterest", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()

                await scfxBridge.setPoolAccInterest(ethers.parseEther("3000"), { value: ethers.parseEther("3000") })

                expect(scfxBridge.stakeVotes()).to.not.emit(posPool, "EventIncreaseStake");
            })

            it("should return if 'balance - (needRedeem + poolAccInterest)' less than 1 vote", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()

                await accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("800") })

                expect(scfxBridge.stakeVotes()).to.not.emit(posPool, "EventIncreaseStake");
            })
        })

        it("should not stakeVotes if not owner", async () => {
            const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()
            expect(scfxBridge.connect(accounts[1]).stakeVotes()).to.be.rejectedWith(errorMessages.onlyOwner)
        })
    });

    describe("unstakeVotes()", async () => {
        describe("should unstake votes", async () => {
            it("should unstake votes when 'balance - (needRedeem + poolAccInterest)' not less than 1 vote ", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()

                // transfer 3000 eth
                // await accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("3000") })
                // set needRedeem to 1000 eth and poolAccInterest to 1eth
                // await eScfx.setTotalClaimed(ethers.parseEther("1000"))
                // await scfxBridge.depositPoolInterest({ value: ethers.parseEther("1") })

                await posPool.setUserSummary(scfxBridge, {
                    votes: 1,
                    available: 0,
                    locked: 1,
                    unlocked: 0,
                    claimedInterest: 0,
                    currentInterest: 0,
                })

                await expect(scfxBridge.unstakeVotes(1)).to.emit(posPool, "EventDecreaseStake");
            })
        })

        describe("should not unstake votes", async () => {
            it("should not unstakeVotes if insufficient votes", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()
                await expect(scfxBridge.unstakeVotes(1)).to.be.rejectedWith(errorMessages.insufficientVotes)
            })

            it("should not unstakeVotes if not owner", async () => {
                const { accounts, posPool, eScfx, scfxBridge } = await deployScfxBrdigeFixture()
                await expect(scfxBridge.connect(accounts[1]).unstakeVotes(1)).to.be.rejectedWith(errorMessages.onlyOwner)
            })
        })
    });

    describe("handleRedeem()", async () => {
        describe("should handleRedeem", async () => {
            it("should withdrawStake if user has unlocked vote", async () => {
                const { accounts, posPool, scfxBridge } = await deployScfxBrdigeFixture()

                await posPool.setUserSummary(scfxBridge, {
                    votes: 1,
                    available: 0,
                    locked: 0,
                    unlocked: 1,
                    claimedInterest: 0,
                    currentInterest: 0,
                })

                expect(scfxBridge.handleRedeem()).to.emit(posPool, "EventWithdrawStake").withArgs(1)
            });

            it("should call scfxBridege.handleRedeem if has redeems", async () => {
                const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

                // deposit to bridge and stake votes
                await accounts[10].sendTransaction({ to: scfxBridge, value: ethers.parseEther("2000") })

                await eScfx.setRedeemLen(1)
                await eScfx.setFirstRedeemAmount(ethers.parseEther("1000"))

                await expect(scfxBridge.handleRedeem()).to.emit(eScfx, "EventHandleRedeem");
            });

            it("should not decrease stake if 'unlocking + balance >= redeeming'", async () => {
                const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

                // deposit to bridge and stake votes
                await accounts[10].sendTransaction({ to: scfxBridge, value: ethers.parseEther("2000") })

                await eScfx.setRedeemLen(1)
                await eScfx.setFirstRedeemAmount(ethers.parseEther("1000"))
                await posPool.setUserSummary(scfxBridge, {
                    votes: 1,
                    available: 0,
                    locked: 0,
                    unlocked: 1,
                    claimedInterest: 0,
                    currentInterest: 0,
                })
                await eScfx.setTotalClaimed(1)
                await expect(scfxBridge.handleRedeem()).to.not.emit(posPool, "EventDecreaseStake");
            });

            it("should call pospool.descreaseStake if has locked votes and redeeming", async () => {
                const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

                await eScfx.setRedeemLen(1)
                await eScfx.setFirstRedeemAmount(ethers.parseEther("1000"))

                // unlocking = 0
                await posPool.setUserSummary(scfxBridge, {
                    votes: 1,
                    available: 1,
                    locked: 1,
                    unlocked: 0,
                    claimedInterest: 0,
                    currentInterest: 0,
                })

                await eScfx.setTotalClaimed(1)
                await expect(scfxBridge.handleRedeem()).to.emit(posPool, "EventDecreaseStake").withArgs(1);
            });

            it("should not call pospool.descreaseStake if has locking not less than redeeming", async () => {
                const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

                await eScfx.setRedeemLen(1)
                await eScfx.setFirstRedeemAmount(ethers.parseEther("1000"))

                // unlocking = 1
                await posPool.setUserSummary(scfxBridge, {
                    votes: 1,
                    available: 1,
                    locked: 0,
                    unlocked: 0,
                    claimedInterest: 0,
                    currentInterest: 0,
                })

                await eScfx.setTotalClaimed(1)
                await expect(scfxBridge.handleRedeem()).to.not.emit(posPool, "EventDecreaseStake");
            });
        })


        it("should not claimInterest if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).handleRedeem()
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("handleFirstRedeem()", async () => {
        it("should return if balance small than 1st redeem amount", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()
            await eScfx.connect(accounts[1]).deposit({ value: ethers.parseEther("2000") })
            await eScfx.connect(accounts[1]).redeem(ethers.parseEther("1000"))

            expect(scfxBridge.handleFirstRedeem()).to.be.not.rejected;
        })

        it("should handleFirstRedeem if balance not small than 1st redeem amount", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            // deposit to bridge and stake votes
            await accounts[10].sendTransaction({ to: scfxBridge, value: ethers.parseEther("2000") })

            await eScfx.setRedeemLen(1)
            await eScfx.setFirstRedeemAmount(ethers.parseEther("1000"))

            await scfxBridge.handleFirstRedeem()

            await expect(scfxBridge.handleRedeem()).to.emit(eScfx, "EventHandleRedeem");
        })

        it("should not handleFirstRedeem if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).handleFirstRedeem()
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    // describe("stakerNumber()", async () => {
    //     it("should return staker number", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

    //         await eScfx.setStakerNumber(1)
    //         var stakerNumber = await scfxBridge.stakerNumber()

    //         expect(Number(stakerNumber)).to.be.equal(1)
    //     })
    // });

    describe("eSpaceAddAssets()", async () => {
        it("should triger sCfx AddAssets", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()
            await expect(scfxBridge.eSpaceAddAssets(10)).to.emit(eScfx, "EventAddAssets").withArgs(10)
        })

        it("should not eSpaceAddAssets if not owner", async () => {
            const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

            await expect(
                scfxBridge.connect(accounts[1]).eSpaceAddAssets(10)
            ).to.rejectedWith(errorMessages.onlyOwner);
        })
    });

    describe("eSpaceHandleRedeem()", async () => {
        it("should triger sCfx HandleRedeem if balance enough", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await accounts[10].sendTransaction({ to: scfxBridge, value: 10 })

            await expect(scfxBridge.eSpaceHandleRedeem(10)).to.emit(eScfx, "EventHandleRedeem").withArgs(10)
        })

        describe("should not eSpaceHandleRedeem", async () => {
            it("should not eSpaceHandleRedeem if balance not enough", async () => {
                const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()
                await expect(scfxBridge.eSpaceHandleRedeem(10)).to.be.rejectedWith(errorMessages.insufficientBalance)
            })

            it("should not eSpaceHandleRedeem if not owner", async () => {
                const { accounts, scfxBridge } = await deployScfxBrdigeFixture();

                await expect(
                    scfxBridge.connect(accounts[1]).eSpaceHandleRedeem(10)
                ).to.rejectedWith(errorMessages.onlyOwner);
            })
        })
    });

    describe("eSpaceRedeemLen()", async () => {
        it("should return sCfx redeemLen", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setRedeemLen(10);

            const redeemLen = await scfxBridge.eSpaceRedeemLen()
            await expect(redeemLen).to.be.equal(10);
        })
    });

    describe("eSpaceFirstRedeemAmount()", async () => {
        it("should return sCfx FirstRedeemAmount", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setFirstRedeemAmount(10);

            const firstRedeemAmount = await scfxBridge.eSpaceFirstRedeemAmount()
            await expect(firstRedeemAmount).to.be.equal(10);
        })
    });

    describe("eSpacePoolTotalClaimed()", async () => {
        it("should return sCfx TotalClaimed", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setTotalClaimed(10);

            const totalClaimd = await scfxBridge.eSpacePoolTotalClaimed()
            await expect(totalClaimd).to.be.equal(10);
        })
    });

    describe("eSpacePoolStakerNumber()", async () => {
        it("should return sCfx StakerNumber", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setStakerNumber(10);

            const stakerNumber = await scfxBridge.eSpacePoolStakerNumber()
            await expect(stakerNumber).to.be.equal(10);
        })
    });

    describe("eSpacePoolTotalDeposited()", async () => {
        it("should return sCfx TotalDeposited", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setTotalDeposited(10);

            const totalDeposited = await scfxBridge.eSpacePoolTotalDeposited()
            await expect(totalDeposited).to.be.equal(10);
        })
    });

    describe("eSpacePoolTotalSupply()", async () => {
        it("should return sCfx TotalSupply", async () => {
            const { accounts, posPool, scfxBridge, eScfx } = await deployScfxBrdigeFixture()

            await eScfx.setTotalSupply(10);

            const totalSupply = await scfxBridge.eSpacePoolTotalSupply()
            await expect(totalSupply).to.be.equal(10);
        })
    });

    // describe("eSpaceVotingSetCoreInfo()", async () => {
    //     it("should eSpaceVotingSetCoreInfo", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

    //         await expect(scfxBridge.eSpaceVotingSetCoreInfo()).to.emit(votingEscrow, "EventSetCoreInfo")
    //     })
    //     it("should not eSpaceVotingSetCoreInfo if not owner", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

    //         await expect(scfxBridge.connect(accounts[1]).eSpaceVotingSetCoreInfo()).to.be.rejected
    //     })
    // });

    describe("eSpaceVotingLastUnlockBlock()", async () => {
        it("should eSpaceVotingLastUnlockBlock", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await votingEscrow.setLastUnlockBlock(100);
            const lastUnlockBlock = await scfxBridge.eSpaceVotingLastUnlockBlock();

            expect(Number(lastUnlockBlock)).to.be.equal(100);
        })
    });

    describe("eSpaceVotingGlobalLockAmount()", async () => {
        it("should eSpaceVotingGlobalLockAmount", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await votingEscrow.setGlobalLockAmount(100000, 100);
            const globalLockAmount = await scfxBridge.eSpaceVotingGlobalLockAmount(100000);

            expect(Number(globalLockAmount)).to.be.equal(100);
        })
    });

    describe("eSpaceVotingPoolVoteInfo()", async () => {
        it("should eSpaceVotingPoolVoteInfo", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await votingEscrow.setPoolVoteInfo(1, 1, [1, 2, 3]);
            const voteInfo = await scfxBridge.eSpaceVotingPoolVoteInfo(1, 1);

            expect(voteInfo.toString()).to.be.equal((["1", "2", "3"]).toString());
        })
    });

    describe("isLockInfoChanged()", async () => {
        it("should return false if not change", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            const isChanged = await scfxBridge.isLockInfoChanged();

            expect(Boolean(isChanged)).to.false;
        })

        it("should return true if changed", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await votingEscrow.setLastUnlockBlock(100000000)
            await votingEscrow.setGlobalLockAmount(100000000, 100);

            const isChanged = await scfxBridge.isLockInfoChanged();

            expect(Boolean(isChanged)).to.true;
        })
    });

    describe("syncLockInfo()", async () => {
        it("should return if last unlock block numbler is small than now", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await expect(scfxBridge.syncLockInfo()).to.not.emit(posPool, "EventLockForVotePower");
        })

        it("should return if last unlock block numbler is small than now", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()
            await votingEscrow.setLastUnlockBlock(100000)
            await votingEscrow.setGlobalLockAmount(100000, 100);

            await expect(scfxBridge.syncLockInfo()).to.emit(posPool, "EventLockForVotePower");
        })

        it("should updateLockInfo if not owner", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            await expect(scfxBridge.connect(accounts[1]).syncLockInfo()).to.not.be.rejected
        })
    })

    describe("isVoteInfoChanged()", async () => {
        it("should return false if not change", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow } = await deployScfxBrdigeFixture()

            const isChanged = await scfxBridge.isVoteInfoChanged();

            expect(Boolean(isChanged)).to.false;
        })

        it("should return true if changed", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            const currentRound = await paramsControl.currentRound()
            expect(Number(currentRound)).to.be.equal(0)

            await votingEscrow.setPoolVoteInfo(0, 0, [1, 2, 3])

            const cachedPoolVotingInfo = []
            cachedPoolVotingInfo.push(await scfxBridge.poolVoteInfo(0, 0, 0))
            cachedPoolVotingInfo.push(await scfxBridge.poolVoteInfo(0, 0, 1))
            cachedPoolVotingInfo.push(await scfxBridge.poolVoteInfo(0, 0, 2))
            expect(cachedPoolVotingInfo.toString()).to.be.equal((["0", "0", "0"]).toString())

            const runtimePoolVotingInfo = await scfxBridge.eSpaceVotingPoolVoteInfo(0, 0)
            expect(runtimePoolVotingInfo.toString()).to.be.equal((["1", "2", "3"]).toString())

            const isChanged = await scfxBridge.isVoteInfoChanged();

            expect(Boolean(isChanged)).to.true;
        })
    })

    describe("isVotesEqual()", async () => {
        it("should equal", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            const isEqual = await scfxBridge.isVotesEqual([1, 2, 3], [1, 2, 3])
            expect(isEqual).to.true
        })

        it("should not equal", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            var isEqual = await scfxBridge.isVotesEqual([0, 0, 0], [1, 2, 3])
            expect(isEqual).to.false

            var isEqual = await scfxBridge.isVotesEqual([1, 2, 3], [0, 0, 0])
            expect(isEqual).to.false
        })
    })

    describe("syncVoteInfo()", async () => {
        it("should update vote info when changed", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()
            await votingEscrow.setPoolVoteInfo(0, 0, [1, 2, 3])

            await expect(scfxBridge.syncVoteInfo()).to.emit(posPool, "EventCastVote")
        })

        it("should not update vote info when unchanged", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            await expect(scfxBridge.syncVoteInfo()).to.not.emit(posPool, "EventCastVote")
        })

        it("should syncVoteInfo if not owner", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            await expect(scfxBridge.connect(accounts[1]).syncVoteInfo()).to.not.be.rejected
            // await expect(scfxBridge.connect(accounts[1]).syncVoteInfo(ethers.Typed.uint16(1))).to.be.rejectedWith(errorMessages.onlyOwner)
        })
    })

    // describe("transferToEspacePool()", async () => {
    //     it("should transferToEspacePool", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

    //         accounts[1].sendTransaction({ to: scfxBridge, value: ethers.parseEther("1") })
    //         await scfxBridge.transferToEspacePool(ethers.Typed.uint256(1));

    //         const eScfxBalance = await ethers.provider.getBalance(eScfx)
    //         expect(Number(eScfxBalance)).to.be.equal(1)
    //     })

    //     it("should not transferToEspacePool if balance not enough", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

    //         await expect(
    //             scfxBridge.transferToEspacePool(ethers.Typed.uint256(1))
    //         ).to.be.rejectedWith(errorMessages.notEnoughBalance);
    //     })

    //     it("should not transferToEspacePool if not owner", async () => {
    //         const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

    //         await expect(
    //             scfxBridge.connect(accounts[1]).transferToEspacePool(ethers.Typed.uint256(1))
    //         ).to.be.rejectedWith(errorMessages.onlyOwner)

    //         await expect(
    //             scfxBridge.connect(accounts[1]).transferToEspacePool()
    //         ).to.be.rejectedWith(errorMessages.onlyOwner)
    //     })
    // })

    describe("mappedBalance()", async () => {
        it("should return mappedBalance", async () => {
            const { accounts, posPool, scfxBridge, bridgeMockMappedAddress, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            await accounts[1].sendTransaction({ to: bridgeMockMappedAddress, value: ethers.parseEther("1") })

            const mappedBalance = await scfxBridge.mappedBalance()
            expect(Number(mappedBalance)).to.be.equal(1e18)
        })
    })

    describe("transferFromEspace()", async () => {
        it("should transferFromEspace", async () => {
            const { accounts, posPool, scfxBridge, bridgeMockMappedAddress, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            accounts[1].sendTransaction({ to: bridgeMockMappedAddress, value: ethers.parseEther("1") })
            await scfxBridge.transferFromEspace(ethers.Typed.uint256(1));

            const bridgeBalance = await ethers.provider.getBalance(scfxBridge)
            expect(Number(bridgeBalance)).to.be.equal(1)
        })

        it("should transfer all from espace", async () => {
            const { accounts, posPool, scfxBridge, bridgeMockMappedAddress, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            accounts[1].sendTransaction({ to: bridgeMockMappedAddress, value: ethers.parseEther("1") })
            await scfxBridge.transferFromEspace();

            const bridgeBalance = await ethers.provider.getBalance(scfxBridge)
            expect(Number(bridgeBalance)).to.be.equal(1e18)
        })

        it("should not transferFromEspace if balance not enough", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            await expect(
                scfxBridge.transferFromEspace(ethers.Typed.uint256(1))
            ).to.be.rejectedWith(errorMessages.notEnoughBalance);
        })

        it("should not transferFromEspace if not owner", async () => {
            const { accounts, posPool, scfxBridge, eScfx, votingEscrow, paramsControl } = await deployScfxBrdigeFixture()

            await expect(
                scfxBridge.connect(accounts[1]).transferFromEspace(ethers.Typed.uint256(1))
            ).to.be.rejectedWith(errorMessages.onlyOwner)

            await expect(
                scfxBridge.connect(accounts[1]).transferFromEspace()
            ).to.be.rejectedWith(errorMessages.onlyOwner)
        })
    })




})