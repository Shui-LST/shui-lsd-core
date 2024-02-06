const hre = require("hardhat");
const { expect, assert } = require("chai");
const { account } = require("../scripts/core/init");
const { ethers } = hre;

const errorMessages = {
    initializeTwice: "Initializable: contract is already initialized",
    onlyBridge: "Only bridge is allowed",
    DepositMustPositive: "deposit amount must be greater than 0",
    RedeemMustPositive: "redeem amount must be greater than 0",
    WithdrawMustPositive: "withdraw amount must be greater than 0",
    NotEnoughClaimable: "not enough claimable amount",
    NotEnoughContractBalance: "not enough contract balance",
    BalanceNotEnough: "balance not enough",
    RedeemQueueEmpty: "redeeming queue is empty",
    RedeemAmountNotMatch: "redeem amount not match",
    RedeemAmountAbnormal: "abnormal value",
};

describe("sCFX", async function () {
    async function deployScfxFixtrue() {
        const RATIO_BASE = 1000_000_000;
        const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

        const accounts = await ethers.getSigners();

        const MockVoingEscrow = await ethers.getContractFactory("MockVotingEscrow");
        const votingEscrow = await MockVoingEscrow.deploy();

        const SCFX = await ethers.getContractFactory("DebugSCFX");
        const scfx = await SCFX.deploy();

        // await scfx.initialize()

        let bridge = accounts[9];
        await scfx.setmappedsCFXBridge(bridge);
        await scfx.setVotingEscrow(votingEscrow);

        return {
            accounts,
            bridge,
            votingEscrow,
            scfx,
            RATIO_BASE,
            ADDRESS_ZERO
        };
    }

    describe("initialize()", async () => {
        it("should initializate contract", async () => {
            const { scfx } = await deployScfxFixtrue();
            const expectedValues = {
                name: "Shui CFX",
                symbol: "sCFX",
            }

            //check expected initial values
            expect(String(await scfx.name())).to.be.equal(expectedValues.name);
            expect(String(await scfx.symbol())).to.be.equal(expectedValues.symbol);
        });


        it("not allow double initialization", async () => {
            //pool already initialized
            const { scfx } = await deployScfxFixtrue();
            await expect(scfx.initialize()).to.eventually.rejectedWith(
                errorMessages.initializeTwice
            );
        });
    });

    describe("deposit()", async () => {
        describe("should deposit", async () => {
            it("should exchange rate be 1 when totalsupply is 0", async () => {
                const { scfx, accounts, bridge } = await deployScfxFixtrue();
                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })

                const balance = await scfx.balanceOf(accounts[1])
                expect(Number(balance)).to.be.equal(1e18);

                const totalSupply = await scfx.totalSupply()
                expect(Number(totalSupply)).to.be.equal(1e18);
            })

            it("should exchange rate correct when totalsupply is not zero", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();
                // scfx.mint(accounts[0], 1)
                await scfx.deposit({ value: ethers.parseEther("1") })
                await scfx.setTotalDeposited(ethers.parseEther("2"))
                // 单价为 1/2

                await expect(
                    scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })
                ).to.emit(scfx, "Transfer").withArgs(ADDRESS_ZERO, accounts[1].address, BigInt(0.5e18))
            })

            it("should transfer cfx to bridge after deposit", async () => {
                const { scfx, accounts, bridge } = await deployScfxFixtrue();

                const bridgeBalancePre = await ethers.provider.getBalance(bridge);
                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })
                const bridgeBalancePost = await ethers.provider.getBalance(bridge);

                expect(Number(bridgeBalancePost - bridgeBalancePre)).to.be.equal(1e18)
            })
        })


        it("should not deposit if amount is 0", async () => {
            const { scfx, accounts, bridge } = await deployScfxFixtrue();
            await expect(
                scfx.connect(accounts[1]).deposit()
            ).to.be.rejectedWith(errorMessages.DepositMustPositive);
        })
    })

    describe("redeem()", async () => {
        describe("should redeem", async () => {
            it("should exchange rate is 1", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })

                const redeemScfx = ethers.parseEther("1")
                const cfxAmount = ethers.parseEther("1")

                await expect(
                    scfx.connect(accounts[1]).redeem(redeemScfx)
                ).to.emit(scfx, "Transfer").withArgs(accounts[1].address, ADDRESS_ZERO, redeemScfx)

                const totalDeposited = await scfx.totalDeposited()
                const totalClaimed = await scfx.totalClaimed()
                const userClaimed = await scfx.userClaimed(accounts[1])

                expect(Number(totalDeposited)).to.be.equal(0)
                expect(totalClaimed).to.be.equal(cfxAmount)
                expect(userClaimed).to.be.equal(cfxAmount)
            })

            it("should exchange rate correct", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();
                // scfx.mint(accounts[0], 1)
                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })
                await scfx.setTotalDeposited(ethers.parseEther("2"))

                const redeemScfx = ethers.parseEther("1")
                const cfxAmount = ethers.parseEther("2")

                await expect(
                    scfx.connect(accounts[1]).redeem(redeemScfx)
                ).to.emit(scfx, "Transfer").withArgs(accounts[1].address, ADDRESS_ZERO, redeemScfx)

                const userClaimed = await scfx.userClaimed(accounts[1])
                expect(userClaimed).to.be.equal(cfxAmount)
            })
        })

        describe("should not redeem", async () => {
            it("should not redeem when balance not enough", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();
                await expect(
                    scfx.connect(accounts[1]).redeem(1)
                ).to.be.rejectedWith(errorMessages.BalanceNotEnough)
            })

            it("should not redeem 0", async () => {
                const { scfx, accounts, bridge } = await deployScfxFixtrue();
                await expect(
                    scfx.connect(accounts[1]).redeem(0)
                ).to.be.rejectedWith(errorMessages.RedeemMustPositive);
            })
        })
    })

    describe("withdraw()", async () => {
        it("should withdraw", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.setUserWithdrawable(accounts[1], ethers.parseEther("1"))
            await accounts[2].sendTransaction({ to: scfx, value: ethers.parseEther("100") })

            const amount = ethers.parseEther("1")
            await expect(
                scfx.connect(accounts[1]).withdraw(amount)
            ).to.emit(scfx, "Withdraw").withArgs(accounts[1].address, amount)

            const withdrawable = await scfx.userWithdrawable(accounts[1])
            expect(Number(withdrawable)).to.be.equal(0)
        })

        describe("should not withdraw", async () => {
            it("should not withdraw if amount is 0", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();
                await expect(
                    scfx.connect(accounts[1]).withdraw(0)
                ).to.be.rejectedWith(errorMessages.WithdrawMustPositive)
            })

            it("should not withdraw if amount is greater than withdrawable", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();
                await expect(
                    scfx.connect(accounts[1]).withdraw(1)
                ).to.be.rejectedWith(errorMessages.NotEnoughClaimable)
            })

            it("should not withdraw if amount is greater than contract balance", async () => {
                const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await scfx.setUserWithdrawable(accounts[1], ethers.parseEther("1"))

                await expect(
                    scfx.connect(accounts[1]).withdraw(1)
                ).to.be.rejectedWith(errorMessages.NotEnoughContractBalance)
            })
        })


    })

    describe("ratioDepositedBySupply", async () => {
        it("should return RATIO_BASE if totalsupply is 0", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO, RATIO_BASE } = await deployScfxFixtrue();

            const result = await scfx.ratioDepositedBySupply()
            await expect(Number(result)).to.be.equal(RATIO_BASE)
        })

        it("should return correct if totalsupply > 0", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO, RATIO_BASE } = await deployScfxFixtrue();

            await scfx.deposit({ value: ethers.parseEther("1") })
            await scfx.setTotalDeposited(ethers.parseEther("2"))

            const result = await scfx.ratioDepositedBySupply()
            await expect(Number(result)).to.be.equal(2 * RATIO_BASE)
        })
    })

    describe("stakerNumber", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            var stakerNum = await scfx.stakerNumber()
            await expect(Number(stakerNum)).to.be.equal(0)

            await scfx.deposit({ value: ethers.parseEther("1") })

            var stakerNum = await scfx.stakerNumber()
            await expect(Number(stakerNum)).to.be.equal(1)
        })
    })

    describe("stakerAddress", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })

            var staker = await scfx.stakerAddress(0)
            await expect(staker).to.be.equal(accounts[1].address)
        })
    })

    describe("redeemLen", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })
            await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

            var redeemLen = await scfx.redeemLen()
            await expect(Number(redeemLen)).to.be.equal(1)
        })
    })


    describe("firstRedeemAmount", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            var redeemAmount = await scfx.firstRedeemAmount()
            await expect(Number(redeemAmount)).to.be.equal(0)

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("1") })
            await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

            var redeemAmount = await scfx.firstRedeemAmount()
            await expect(Number(redeemAmount)).to.be.equal(1e18)
        })
    })

    describe("userVotePower", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await votingEscrow.setUserVotePower(accounts[1], 10);

            const votePower = await scfx.userVotePower(accounts[1]);
            expect(Number(votePower)).to.be.equal(10);
        })
    })

    describe("redeemQueue", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("10") })
            for (let i = 1; i < 10; i++) {
                await scfx.connect(accounts[1]).redeem(i);
            }

            const redeemQueue = await scfx.redeemQueue();
            expect(Number(redeemQueue.length)).to.be.equal(9);
            expect(Number(redeemQueue[0].amount)).to.be.equal(1);
            expect(redeemQueue[0].user).to.be.equal(accounts[1].address);
        })
    })

    describe("redeemQueue2", async () => {
        it("should return correct", async () => {
            const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("10") })
            for (let i = 1; i < 10; i++) {
                await scfx.connect(accounts[1]).redeem(i);
            }

            const redeemQueue = await scfx.redeemQueue(ethers.Typed.uint256(2), ethers.Typed.uint256(2));
            expect(Number(redeemQueue.length)).to.be.equal(2);
            expect(Number(redeemQueue[0].amount)).to.be.equal(3);
            expect(redeemQueue[0].user).to.be.equal(accounts[1].address);
        })
    })

    describe("handleRedeem", async () => {
        it("should handleRedeem", async () => {
            const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

            await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("3") })
            await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))
            await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

            await scfx.connect(bridge).handleRedeem({ value: ethers.parseEther("1") })

            const expectVals = {
                redeemLen: 1,
                totalClaimed: 1e18,
                userWithdrawable: 1e18,
                userClaimed: 1e18,
            }

            const redeemLen = await scfx.redeemLen()
            const totalClaimed = await scfx.totalClaimed()
            const userWithdrawable = await scfx.userWithdrawable(accounts[1])
            const userClaimed = await scfx.userClaimed(accounts[1])
            expect(Number(redeemLen)).to.be.equals(expectVals.redeemLen)
            expect(Number(totalClaimed)).to.be.equals(expectVals.totalClaimed)
            expect(Number(userWithdrawable)).to.be.equals(expectVals.userWithdrawable)
            expect(Number(userClaimed)).to.be.equals(expectVals.userClaimed)
        })

        describe("should not handleRedeem", async () => {
            it("should fail when redeem queue empty", async () => {
                const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await expect(
                    scfx.connect(bridge).handleRedeem({ value: ethers.parseEther("1") })
                ).to.be.rejectedWith(errorMessages.RedeemQueueEmpty)
            })

            it("should fail when redeem amount not match", async () => {
                const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("3") })
                await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

                await expect(
                    scfx.connect(bridge).handleRedeem()
                ).to.be.rejectedWith(errorMessages.RedeemAmountNotMatch)
            })

            it("should fail when redeem amount greater than total claimed", async () => {
                const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("3") })
                await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

                await scfx.setTotalClaimed(ethers.parseEther("0.5"))
                await expect(
                    scfx.connect(bridge).handleRedeem({ value: ethers.parseEther("1") })
                ).to.be.rejectedWith(errorMessages.RedeemAmountAbnormal)
            })

            it("should fail if caller not bridge", async () => {
                const { scfx, accounts, votingEscrow, bridge, ADDRESS_ZERO } = await deployScfxFixtrue();

                await scfx.connect(accounts[1]).deposit({ value: ethers.parseEther("3") })
                await scfx.connect(accounts[1]).redeem(ethers.parseEther("1"))

                await expect(
                    scfx.handleRedeem({ value: ethers.parseEther("1") })
                ).to.be.rejectedWith(errorMessages.onlyBridge)
            })

        })
    })











})