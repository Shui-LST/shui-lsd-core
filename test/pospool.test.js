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
};

describe("PoSPool", async function () {
    async function deployPoSPoolFixture() {
        const IDENTIFIER =
            "0x0000000000000000000000000000000000000000000000000000000000000000";
        const ONE_VOTE_CFX = 1000;
        const ONE_DAY_BLOCK_COUNT = 2 * 3600 * 24;
        const ONE_YEAR_BLOCK_COUNT = ONE_DAY_BLOCK_COUNT * 365;
        const RATIO_BASE = 10000;

        const blsPubKeyProof = ["0x00", "0x00"];
        const blsPubKey = "0x00";
        const vrfPubKey = "0x00";

        const accounts = await ethers.getSigners();

        /// Mock Deployment
        const MockStaking = await ethers.getContractFactory("MockStaking");
        const staking = await MockStaking.deploy();

        const MockPoSRegister = await ethers.getContractFactory("MockPoSRegister");
        const posRegister = await MockPoSRegister.deploy();

        const MockParamsControl = await ethers.getContractFactory("MockParamsControl");
        const paramsControl = await MockParamsControl.deploy();

        // const MockCrossSpaceCall = await ethers.getContractFactory("MockCrossSpaceCall");
        // const crossSpaceCall = await MockCrossSpaceCall.deploy();

        // const sCFXBridge = await ethers.getContractFactory("sCFXBridge");
        // const scfxBridge = await sCFXBridge.deploy();

        // await scfxBridge.initialize(await crossSpaceCall.getAddress(), await paramsControl.getAddress());

        // console.log(`deployed. staking:${await staking.getAddress()},posRegister:${await posRegister.getAddress()},paramsControl:${await paramsControl.getAddress()}`)

        /// Contract Deployment
        const PoSPool = await ethers.getContractFactory("DebugPoSPool");
        const pool = await PoSPool.deploy();
        // await pool.deployed();
        await pool.initialize(staking, posRegister, paramsControl);
        return {
            accounts,
            pool,
            staking,
            // scfxBridge,
            //   bridge,
            IDENTIFIER,
            ONE_VOTE_CFX,
            ONE_DAY_BLOCK_COUNT,
            ONE_YEAR_BLOCK_COUNT,
            RATIO_BASE,
            blsPubKeyProof,
            blsPubKey,
            vrfPubKey,
        };
    }

    async function registeredPoSPoolFixture() {
        const poolInitialized = await deployPoSPoolFixture();
        const {
            pool,
            IDENTIFIER,
            blsPubKey,
            vrfPubKey,
            blsPubKeyProof,
            ONE_VOTE_CFX,
            // bridge,
        } = poolInitialized;
        //register pool with 1000 CFX
        await pool.register(IDENTIFIER, 1, blsPubKey, vrfPubKey, blsPubKeyProof, {
            value: ethers.parseEther(`${ONE_VOTE_CFX}`),
        });

        //initialize and set bridge
        // await bridge.initialize(pool.address);
        // await pool._setbridges(bridge.address, bridge.address, bridge.address);

        return { ...poolInitialized };
    }

    async function clearPeroidFixtrue() {
        const poolInitialized = await registeredPoSPoolFixture();
        await poolInitialized.pool.setLockPeriod(0)
        await poolInitialized.pool.setUnlockPeriod(0)
        return poolInitialized;
    }

    async function genBlocks(num) {
        const accounts = await ethers.getSigners()
        const start = await ethers.provider.getBlockNumber()
        for (let i = 0; i < num; i++) {
            await accounts[10].sendTransaction({ from: accounts[10], to: accounts[10] });
        }
        const end = await ethers.provider.getBlockNumber()
        expect(end).to.be.greaterThanOrEqual(start + 10);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    describe("Initialize()", async () => {
        it("should initializate contract", async () => {
            const ONE_DAY_BLOCK_COUNT = 2 * 3600 * 24;
            const expectedValues = {
                // poolName: "Shui Conflux Pos Pool 01",
                // RATIO_BASE: 10000,
                // CFX_COUNT_OF_ONE_VOTE: 1000,
                // CFX_VALUE_OF_ONE_VOTE: ethers.parseEther("1000"),
                // ONE_DAY_BLOCK_COUNT: ONE_DAY_BLOCK_COUNT,
                // ONE_YEAR_BLOCK_COUNT: ONE_DAY_BLOCK_COUNT * 365,
                poolUserShareRatio: 9900,
                _poolLockPeriod: ONE_DAY_BLOCK_COUNT * 13 + 3600,
                _poolUnlockPeriod: ONE_DAY_BLOCK_COUNT * 1 + 3600,
            };
            const { pool } = await deployPoSPoolFixture();

            //check expected initial values
            expect(String(await pool.poolUserShareRatio())).to.be.equal(
                expectedValues.poolUserShareRatio.toString()
            );
            expect(String(await pool._poolLockPeriod())).to.be.equal(
                expectedValues._poolLockPeriod.toString()
            );
            expect(String(await pool._poolUnlockPeriod())).to.be.equal(
                expectedValues._poolUnlockPeriod.toString()
            );
        });

        describe("should not initializate contract in cases", function () {
            it("not allow double initialization", async () => {
                //pool already initialized
                const { pool } = await deployPoSPoolFixture();
                await expect(pool.initialize()).to.eventually.rejectedWith(
                    errorMessages.initializeTwice
                );
            });

            it("not allow initialization with non-valid parameters", async () => {
                const { pool } = await deployPoSPoolFixture();

                await expect(pool.initialize("non-valid-data")).to.eventually.rejected;
                await expect(pool.initialize(0x000)).to.eventually.rejected;
                await expect(pool.initialize(111111111)).to.eventually.rejected;
                await expect(pool.initialize(["1", 2, "3", 4])).to.eventually.rejected;
                await expect(pool.initialize({ a: 1, b: 2 })).to.eventually.rejected;
            });
        });


    });

    describe("poolName()", async function () {
        it("should set pool name", async () => {
            const { pool } = await deployPoSPoolFixture();
            const expectedPoolName = "Shui Conflux Pos Pool";
            await pool.setPoolName(expectedPoolName);
            const poolName = await pool.poolName();
            expect(poolName).to.be.equal(expectedPoolName);
        });

        describe("should not return pool name in cases", function () {
            it("should not return with non-valid parameters", async () => {
                const { pool } = await deployPoSPoolFixture();

                await expect(pool.poolName("non-valid-data")).to.eventually.rejected;
            });
        });
    });

    describe("_poolRegisted()", async function () {
        it("should return the pool is already register", async () => {
            const { pool } = await registeredPoSPoolFixture();
            expect(String(await pool._poolRegisted())).to.be.equal("true");
        });

        it("should return the pool is not registered yet", async () => {
            const { pool } = await deployPoSPoolFixture();
            expect(String(await pool._poolRegisted())).to.be.equal("false");
        });

        describe("should not return if the pool is already register or not", function () {
            it("should not return with non-valid parameters", async () => {
                const { pool } = await deployPoSPoolFixture();
                await expect(pool._poolRegisted("non-valid-data")).to.eventually.rejected;
            });
        });
    });

    describe("register()", function () {
        it("should register pos pool", async () => {
            const votes = 1;
            const { pool } = await registeredPoSPoolFixture();
            const poolSummary = await pool.poolSummary();

            expect(await pool._poolRegisted()).to.be.equal(true);
            expect(String(poolSummary.available)).to.equal(votes.toString());
            expect(String(poolSummary.interest)).to.equal("0");
            expect(String(poolSummary.totalInterest)).to.equal("0");
        });

        it("should NOT register a pos pool twice", async () => {
            const {
                IDENTIFIER,
                pool,
                blsPubKey,
                vrfPubKey,
                blsPubKeyProof,
                ONE_VOTE_CFX,
            } = await registeredPoSPoolFixture();
            const votes = 1;

            await expect(
                pool.register(IDENTIFIER, votes, blsPubKey, vrfPubKey, blsPubKeyProof, {
                    value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
                })
            ).to.eventually.rejectedWith(errorMessages.poolRegistered);
        });

        it("should NOT register if msg.sender is not contract owner", async () => {
            const {
                pool,
                IDENTIFIER,
                ONE_VOTE_CFX,
                blsPubKey,
                vrfPubKey,
                blsPubKeyProof,
                accounts,
            } = await deployPoSPoolFixture();
            const votes = 1;

            //try register from a no owner contract address
            await expect(
                pool.connect(accounts[1]).register(IDENTIFIER, votes, blsPubKey, vrfPubKey, blsPubKeyProof, {
                    value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
                })
            ).to.eventually.rejectedWith(errorMessages.onlyOwner);
        });

        it("should NOT register if bad data is passed as parameter", async () => {
            const { pool, blsPubKey, vrfPubKey, blsPubKeyProof } =
                await deployPoSPoolFixture();

            //try to call register() with error type of data
            await expect(
                pool.register(1, 1, blsPubKey, vrfPubKey, blsPubKeyProof, {
                    value: ethers.parseEther(`${10000}`),
                })
            ).to.eventually.rejected;
        });

        it("should NOT register if votes is less than 1 or msg.value is less than 1000 CFX", async () => {
            const { pool, blsPubKey, vrfPubKey, blsPubKeyProof, IDENTIFIER } =
                await deployPoSPoolFixture();

            await expect(
                pool.register(IDENTIFIER, 0, blsPubKey, vrfPubKey, blsPubKeyProof, {
                    value: ethers.parseEther(`${1000}`),
                })
            ).to.eventually.rejectedWith(errorMessages.registerVP);
            await expect(
                pool.register(IDENTIFIER, 1, blsPubKey, vrfPubKey, blsPubKeyProof, {
                    value: ethers.parseEther(`${10}`),
                })
            ).to.eventually.rejectedWith(errorMessages.registerMsgValue);
        });
    });

    describe("increaseStake()", async function () {
        // FIXME: the emit assert not work
        it("should emit IncreasePoSStake event", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).increaseStake(1, {
                    value: ethers.parseEther(`${ONE_VOTE_CFX}`),
                })
            ).to.eventually.emit("IncreasePoSStake1");
        });

        it("should increase staking amount", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await registeredPoSPoolFixture();

            //check votes is equal to 1 = only the first deposit until now
            let poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("1");

            //deposit 1 votes by user 1

            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${ONE_VOTE_CFX}`),
            });

            poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("2");

            //deposit 7 votes by user 2

            await pool.connect(accounts[2]).increaseStake(7, {
                value: ethers.parseEther(`${7 * ONE_VOTE_CFX}`),
            });

            await pool.connect(accounts[3]).increaseStake(5, {
                value: ethers.parseEther(`${5 * ONE_VOTE_CFX}`),
            });

            poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("14");
        });

        it("should NOT increase staking amount if pool address is not currently registered", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await deployPoSPoolFixture();

            //deposit 1 votes by user 1 directly instead through bridge addres
            await expect(
                pool.connect(accounts[1]).increaseStake(1, {
                    value: ethers.parseEther(`${ONE_VOTE_CFX}`),
                })
            ).to.eventually.rejectedWith(errorMessages.onlyRegisted);
        });

        it("should NOT increase stakig amount if vote power is not greater than zero", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await registeredPoSPoolFixture();

            //deposit 1 votes by user 1 directly instead through bridge addres
            await expect(
                pool.connect(accounts[1]).increaseStake(0, {
                    value: ethers.parseEther(`${ONE_VOTE_CFX}`),
                })
            ).to.eventually.rejectedWith(errorMessages.increaseStakeMinVotePower);
        });

        it("should NOT increase stakig amount if msg.value is not equal to votePower * CFX_VALUE_OF_ONE_VOTE", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await registeredPoSPoolFixture();

            //deposit 1 votes by user 1 directly instead through bridge addres
            await expect(
                pool.connect(accounts[1]).increaseStake(2, {
                    value: ethers.parseEther(`${ONE_VOTE_CFX}`),
                })
            ).to.eventually.rejectedWith(errorMessages.increaseStakeMsgValue);
        });
    });

    describe("userSummary()", async function () {
        it("should be locking when in lock period", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await registeredPoSPoolFixture();
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${ONE_VOTE_CFX}`),
            });
            const userSummary1 = await pool.userSummary(accounts[1]);
            expect(String(userSummary1.votes)).to.be.equal("1");
            expect(String(userSummary1.available)).to.be.equal("1");
            expect(String(userSummary1.locked)).to.be.equal("0");
        });

        it("should locked when out of lock period", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();
            await pool.setLockPeriod(10)
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${ONE_VOTE_CFX}`),
            });

            var userSummary1 = await pool.userSummary(accounts[1]);
            expect(String(userSummary1.votes)).to.be.equal("1");
            expect(String(userSummary1.available)).to.be.equal("1");
            expect(String(userSummary1.locked)).to.be.equal("0");

            await genBlocks(10);

            userSummary1 = await pool.userSummary(accounts[1]);
            expect(String(userSummary1.votes)).to.be.equal("1");
            expect(String(userSummary1.available)).to.be.equal("1");
            expect(String(userSummary1.locked)).to.be.equal("1");
        });

        it("should be unlocking when in the unlock period and unlocked when out of the unlock period", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();
            await pool.setUnlockPeriod(10)
            await pool.connect(accounts[1]).increaseStake(2, {
                value: ethers.parseEther(`${2 * ONE_VOTE_CFX}`),
            });

            // unlock
            await pool.connect(accounts[1]).decreaseStake(1)
            userSummary1 = await pool.userSummary(accounts[1]);
            expect(String(userSummary1.votes)).to.be.equal("2");
            expect(String(userSummary1.available)).to.be.equal("1");
            expect(String(userSummary1.locked)).to.be.equal("1");
            expect(String(userSummary1.unlocked)).to.be.equal("0");

            await genBlocks(10);

            userSummary1 = await pool.userSummary(accounts[1]);
            expect(String(userSummary1.votes)).to.be.equal("2");
            expect(String(userSummary1.available)).to.be.equal("1");
            expect(String(userSummary1.locked)).to.be.equal("1");
            expect(String(userSummary1.unlocked)).to.be.equal("1");
        });
    })

    describe("decreaseStake()", async function () {
        it("should decrease staking amount when vote is locked", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await clearPeroidFixtrue();

            //check votes is equal to 1 = only the first deposit until now
            let poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("1");

            //deposit 1 votes by user 1
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${ONE_VOTE_CFX}`),
            });
            await pool.connect(accounts[2]).increaseStake(12, {
                value: ethers.parseEther(`${12 * ONE_VOTE_CFX}`),
            });

            poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("14");

            //decrease 1 by user 1
            await pool.connect(accounts[1]).decreaseStake(1)
            //decrease 2 by user 2
            await pool.connect(accounts[2]).decreaseStake(2)

            poolSummary = await pool.poolSummary();
            expect(String(poolSummary.available)).to.be.equal("11");
        });

        it("should NOT decrease staking amount if pool address is not currently registered", async () => {
            const { pool, accounts } = await deployPoSPoolFixture();

            //deposit 1 votes by user 1 directly instead through bridge addres
            await expect(
                pool.connect(accounts[1]).decreaseStake(1)
            ).to.eventually.rejectedWith(errorMessages.onlyRegisted);
        });

        it("should NOT decrease staking aomunt if vote power is not enough", async () => {
            const { pool, ONE_VOTE_CFX, accounts } =
                await clearPeroidFixtrue();

            //deposit 1 votes by user 1
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${ONE_VOTE_CFX}`),
            });

            //decrease 1 by user 1
            await expect(
                pool.connect(accounts[1]).decreaseStake(3)
            ).to.eventually.rejectedWith(errorMessages.decreaseStakeLockedNotEnough);
        });
    })

    describe("withdrawStake()", function () {
        it("should withdraw funds after unlocked", async () => {
            const { pool, staking, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();
            await pool.setUnlockPeriod(10)

            expect(
                Number(await ethers.provider.getBalance(pool))
            ).to.be.equal(0);

            //stake by user 1 - 1 votes
            await pool.connect(accounts[1]).increaseStake(2, {
                value: ethers.parseEther(`${2 * ONE_VOTE_CFX}`),
            });

            //stake by user 2 - 3 votes
            await pool.connect(accounts[2]).increaseStake(3, {
                value: ethers.parseEther(`${3 * ONE_VOTE_CFX}`),
            });

            //unstake
            await pool.connect(accounts[1]).decreaseStake(1);
            await pool.connect(accounts[2]).decreaseStake(3);

            await genBlocks(10);
            var userSummary = await pool.userSummary(accounts[1]);
            expect(String(userSummary.unlocked)).to.be.equal("1");

            // staking contract has eth
            expect(
                Number(await ethers.provider.getBalance(await staking.getAddress()))
            ).to.be.equal(6000e18);

            //withdraw
            await pool.connect(accounts[1]).withdrawStake(1);

            userSummary = await pool.userSummary(accounts[1]);
            expect(String(userSummary.unlocked)).to.be.equal("0");

            expect(
                Number(await ethers.provider.getBalance(await staking.getAddress()))
            ).to.be.equal(5000e18);
        });

        it("should remover stakers when user all vote unstaked", async () => {
            const { pool, staking, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();
            await pool.setUnlockPeriod(10)

            //stake by user 1 - 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });

            await accounts[10].sendTransaction({ to: await pool.getAddress(), value: ethers.parseEther("1") })

            await pool.connect(accounts[1]).decreaseStake(1);
            await genBlocks(10);

            var stakerNum = await pool.stakerNumber()
            expect(Number(stakerNum)).to.be.equal(2);

            await pool.connect(accounts[1]).withdrawStake(1);
            var stakerNum = await pool.stakerNumber()
            expect(Number(stakerNum)).to.be.equal(1);
        });

        it("should not withdraw staked funds when unlocking", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();
            await pool.setUnlockPeriod(10)

            expect(
                Number(await ethers.provider.getBalance(pool))
            ).to.be.equal(0);

            //stake by user 1 - 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });

            //stake by user 2 - 3 votes
            await pool.connect(accounts[2]).increaseStake(3, {
                value: ethers.parseEther(`${3 * ONE_VOTE_CFX}`),
            });

            //unstake
            await pool.connect(accounts[1]).decreaseStake(1);
            await pool.connect(accounts[2]).decreaseStake(3);
            await expect(pool.connect(accounts[1]).withdrawStake(1)).to.rejectedWith(errorMessages.withdrawStakeUnlockedNotEnough);

            await genBlocks(10);
            await pool.connect(accounts[1]).withdrawStake(1);
        });

        it("should NOT withdraw staking funds if pool address is not currently registered", async () => {
            const { pool } = await deployPoSPoolFixture();
            await expect(pool.withdrawStake(0)).to.rejectedWith(errorMessages.onlyRegisted);
        });
    });

    describe("userInterest()", async function () {
        it("should return correct interest", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });
            var intrest = await pool.userInterest(accounts[1]);
            expect(intrest.toString()).to.be.equal(ethers.parseEther("0").toString())

            // deposit 100 cfx to mock pos benefit
            await accounts[10].sendTransaction({ from: accounts[10], to: await pool.getAddress(), value: ethers.parseEther("100") })

            // account 1 should have 50*0.99 cfx intrest
            intrest = await pool.userInterest(accounts[1]);
            expect(String(intrest)).to.be.equal(String(ethers.parseEther(`${50 * 0.99}`)))
        });
    });

    describe("claimInterest()", async function () {
        it("should claim intrest", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });
            var intrest = await pool.userInterest(accounts[1]);
            expect(intrest.toString()).to.be.equal(ethers.parseEther("0").toString())

            // deposit 100 cfx to mock pos benefit
            await accounts[10].sendTransaction({ from: accounts[10], to: await pool.getAddress(), value: ethers.parseEther("100") })

            intrest = await pool.userInterest(accounts[1]);
            expect(String(intrest)).to.be.equal(String(ethers.parseEther(`${50 * 0.99}`)))

            // withdraw 1 cfx
            const oldBalance = await ethers.provider.getBalance(accounts[1])
            const tx = await pool.connect(accounts[1]).claimInterest(ethers.parseEther("1"));
            const receipt = await tx.wait();
            const newBalance = await ethers.provider.getBalance(accounts[1])
            const claimed = newBalance - oldBalance + receipt.gasUsed * receipt.gasPrice
            expect(Number(claimed)).to.be.equal(1e18)
        });

        it("should not claim when exceed intrest", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });
            var intrest = await pool.userInterest(accounts[1]);
            expect(intrest.toString()).to.be.equal(ethers.parseEther("0").toString())

            // deposit 100 cfx to mock pos benefit
            await accounts[10].sendTransaction({ from: accounts[10], to: await pool.getAddress(), value: ethers.parseEther("100") });

            intrest = await pool.userInterest(accounts[1]);
            expect(String(intrest)).to.be.equal(String(ethers.parseEther(`${50 * 0.99}`)))

            await expect(pool.connect(accounts[1]).claimInterest(ethers.parseEther("100"))).to.eventually.rejectedWith(errorMessages.intrestNotEnough);
        });

        it("should not claim when not registered", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await deployPoSPoolFixture();
            await expect(pool.connect(accounts[1]).claimInterest(ethers.parseEther("0"))).to.eventually.rejectedWith(errorMessages.onlyRegisted);
        })
    });

    describe("claimAllInterest()", async function () {
        it("should claim all intrest", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await clearPeroidFixtrue();

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });
            var intrest = await pool.userInterest(accounts[1]);
            expect(intrest.toString()).to.be.equal(ethers.parseEther("0").toString())

            // deposit 100 cfx to mock pos benefit
            await accounts[10].sendTransaction({ from: accounts[10], to: await pool.getAddress(), value: ethers.parseEther("100") })

            intrest = await pool.userInterest(accounts[1]);
            expect(String(intrest)).to.be.equal(String(ethers.parseEther(`${50 * 0.99}`)))

            // withdraw all
            const oldBalance = await ethers.provider.getBalance(accounts[1])
            const tx = await pool.connect(accounts[1]).claimAllInterest();
            const receipt = await tx.wait();
            const newBalance = await ethers.provider.getBalance(accounts[1])
            const claimed = newBalance - oldBalance + receipt.gasUsed * receipt.gasPrice
            expect(String(claimed)).to.be.equal(String(ethers.parseEther(`${50 * 0.99}`)))
        });

        it("should not claimAllInterest when not registered", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await deployPoSPoolFixture();
            await expect(pool.connect(accounts[1]).claimAllInterest()).to.eventually.rejectedWith(errorMessages.onlyRegisted);
        });

        it("should not claimAllInterest when no intrest", async () => {
            const { pool, ONE_VOTE_CFX, accounts } = await registeredPoSPoolFixture();
            await expect(pool.connect(accounts[1]).claimAllInterest()).to.eventually.rejectedWith(errorMessages.noClaimableInterest);
        });
    });

    describe("poolSummary()", async function () {
        it("should return pool summary", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            var poolSummary = await pool.poolSummary();
            var {
                available,
                interest,
                totalInterest,
            } = poolSummary;

            expect(String(available)).to.be.equal("1");
            expect(String(interest)).to.be.equal("0");
            expect(String(totalInterest)).to.be.equal("0");

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });
            // deposit 100 cfx to mock pos benefit
            await accounts[10].sendTransaction({ from: accounts[10], to: await pool.getAddress(), value: ethers.parseEther("100") })
            await pool.connect(accounts[1]).claimAllInterest();

            poolSummary = await pool.poolSummary();
            var {
                available,
                interest, // means pool interset after user claimed
                totalInterest,
            } = poolSummary;

            expect(String(available)).to.be.equal("2");
            expect(String(interest)).to.be.equal(String(ethers.parseEther(`${100 * 0.005}`)));
            expect(String(totalInterest)).to.be.equal(String(ethers.parseEther("100")));
        });
    });

    describe("poolAPY()", async function () {
        it("should return pool apy", async () => {
            const { pool, accounts, RATIO_BASE, ONE_VOTE_CFX, ONE_YEAR_BLOCK_COUNT } = await registeredPoSPoolFixture();
            const startBlock = await ethers.provider.getBlockNumber()

            // account 1 - stake 1 votes
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${1 * ONE_VOTE_CFX}`),
            });

            const block1 = await ethers.provider.getBlockNumber()

            // deposit 1 cfx to mock pos benefit
            await accounts[10].sendTransaction({
                to: await pool.getAddress(), value: ethers.parseEther("1")
            })
            await pool.connect(accounts[1]).claimAllInterest();
            const endBlock = await ethers.provider.getBlockNumber()

            const poolAPY = await pool.poolAPY();

            // const perCfxInterest0 = 0
            // const perCfxInterest1 = (1 * 10000) / (2000 * (endBlock - block1))
            // const avrPerCfxInterest = (perCfxInterest0 + perCfxInterest1) / (endBlock - startBlock)

            const totalReward = 1;
            const totalWorkload = 1000 * (block1 - startBlock) + 2000 * (endBlock - block1)
            const expectPoolAPY = totalReward * RATIO_BASE * ONE_YEAR_BLOCK_COUNT / totalWorkload

            console.log(`${startBlock},${block1},${endBlock},${totalWorkload}`)
            expect(String(poolAPY)).to.be.equal(`${expectPoolAPY}`);
        });

        it("should return pool apy consider profit from last pool shot", async () => {
            const { pool, accounts, RATIO_BASE, ONE_VOTE_CFX, ONE_YEAR_BLOCK_COUNT } = await registeredPoSPoolFixture();
            const startBlock = await ethers.provider.getBlockNumber()

            var poolAPY = await pool.poolAPY();
            expect(String(poolAPY)).to.be.equal("0");

            // deposit 1 cfx to mock pos benefit
            await accounts[10].sendTransaction({
                to: await pool.getAddress(), value: ethers.parseEther("1")
            })
            const endBlock = await ethers.provider.getBlockNumber()


            const totalReward = 1;
            const totalWorkload = 1000 * (endBlock - startBlock)
            const expectPoolAPY = totalReward * RATIO_BASE * ONE_YEAR_BLOCK_COUNT / totalWorkload

            console.log(`${startBlock},${endBlock},${totalReward},${totalWorkload}`)

            var poolAPY = await pool.poolAPY();
            expect(String(poolAPY)).to.be.equal(`${expectPoolAPY}`);
        })
    });

    describe("posAddress()", async function () {
        it("schould return pos identifier address", async () => {
            const { pool, accounts, ONE_VOTE_CFX, IDENTIFIER } = await registeredPoSPoolFixture();

            const posAddr = await pool.posAddress();
            expect(String(posAddr)).to.be.equal(IDENTIFIER);
        });

        it("should Not return posAddress if not registed", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await deployPoSPoolFixture();

            await expect(
                pool.posAddress()
            ).to.rejectedWith(errorMessages.onlyRegisted);
        });
    });


    describe("userInQueue()", async function () {
        it("should return balance in queue", async () => {
            const { pool, accounts, ONE_VOTE_CFX } =
                await registeredPoSPoolFixture();

            //deposit from user 1
            const votes = 1
            await pool.connect(accounts[1]).increaseStake(1, {
                value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
            });

            var getInQueue = await pool.userInQueue(accounts[1]);
            expect(getInQueue.length).to.be.equal(1);

            const { votePower, endBlock } = getInQueue[0];

            expect(String(votePower)).to.be.equal(`${votes}`);
            expect(Number(endBlock)).to.be.greaterThan(0);

            getInQueue = await pool.userInQueue(accounts[1], 0, 10);
            expect(getInQueue.length).to.be.equal(1);

            getInQueue = await pool.userInQueue(accounts[1], 1, 10);
            expect(getInQueue.length).to.be.equal(0);
        });
    });

    describe("userOutQueue()", async function () {
        it("should return balance out queue", async () => {
            const { pool, accounts, ONE_VOTE_CFX } =
                await clearPeroidFixtrue();
            await pool.setUnlockPeriod(10);

            //deposit from user 1
            await pool.connect(accounts[1]).increaseStake(2, {
                value: ethers.parseEther(`${2 * ONE_VOTE_CFX}`),
            });

            var userOutQueue = await pool.userOutQueue(accounts[1]);
            expect(userOutQueue.length).to.be.equal(0);

            await pool.connect(accounts[1]).decreaseStake(1);

            userOutQueue = await pool.userOutQueue(accounts[1]);
            expect(userOutQueue.length).to.be.equal(1);

            const { votePower, endBlock } = userOutQueue[0];
            expect(String(votePower)).to.be.equal("1");
            expect(Number(endBlock)).to.be.greaterThan(0);

            userOutQueue = await pool.userOutQueue(accounts[1], 0, 10);
            expect(userOutQueue.length).to.be.equal(1);

            userOutQueue = await pool.userOutQueue(accounts[1], 1, 10);
            expect(userOutQueue.length).to.be.equal(0);
        });
    });

    describe("stakerNumber()", async function () {
        it("should return staker number", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            const votes = 2
            await pool.connect(accounts[1]).increaseStake(votes, {
                value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
            });

            const stakerNumber = await pool.stakerNumber();
            expect(String(stakerNumber)).to.be.equal(`${votes}`);
        });
    });

    describe("stakerAddress()", async function () {
        it("should return staker address", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            const votes = 2
            await pool.connect(accounts[1]).increaseStake(2, {
                value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
            });

            const stakerAddress = await pool.stakerAddress(1);
            expect(String(stakerAddress)).to.be.equal(accounts[1].address);
        });
    });

    describe("userShareRatio()", async function () {
        it("should return share ratio", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            const userShareRatio = await pool.userShareRatio();
            expect(String(userShareRatio)).to.be.equal("9900");
        });
    });

    describe("poolShot()", async function () {
        it("should return pool shot", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            const votes = 2
            const tx = await pool.connect(accounts[1]).increaseStake(votes, {
                value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
            });
            const receipt = await tx.wait()

            const {
                available,
                balance,
                blockNumber,
            } = await pool.poolShot();

            expect(String(available)).to.be.equal("3");
            expect(String(balance)).to.be.equal("0");
            expect(String(blockNumber)).to.be.equal(String(receipt.blockNumber));
        });
    });

    describe("userShot()", async function () {
        it("should return user shot", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            // reward 1 cfx
            await accounts[10].sendTransaction({ to: pool, value: ethers.parseEther("1") })

            const votes = 2
            const tx = await pool.connect(accounts[1]).increaseStake(votes, {
                value: ethers.parseEther(`${votes * ONE_VOTE_CFX}`),
            });
            const receipt = await tx.wait()

            const {
                available,
                accRewardPerCfx,
                blockNumber,
            } = await pool.userShot(accounts[1]);

            expect(String(available)).to.be.equal(`${votes}`);
            expect(String(accRewardPerCfx)).to.be.equal(String(ethers.parseEther("1") / BigInt(1000)));
            expect(String(blockNumber)).to.be.equal(String(receipt.blockNumber));
        });
    });

    describe("setPoolUserShareRatio()", async function () {
        it("should set pool user share ratio", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.setPoolUserShareRatio(100);
            const userShareRatio = await pool.poolUserShareRatio()
            expect(String(userShareRatio)).to.be.equal("100");
        });
        it("should Not setPoolUserShareRatio if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).setPoolUserShareRatio(100)
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
        it("should Not setPoolUserShareRatio if input greater than RATIO_BASE or equal to zero", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.setPoolUserShareRatio(10001)
            ).to.rejectedWith(errorMessages.ratioShouldBe1to10000);
        });
    });

    describe("setLockPeriod()", async function () {
        it("should setLockPeriod", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.setLockPeriod(100);
            const lockPeroid = await pool._poolLockPeriod()
            expect(String(lockPeroid)).to.be.equal("100");
        });
        it("should Not setLockPeriod if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).setLockPeriod(100)
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });

    describe("setUnlockPeriod()", async function () {
        it("should setUnlockPeriod", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.setUnlockPeriod(100);
            const lockPeroid = await pool._poolUnlockPeriod()
            expect(String(lockPeroid)).to.be.equal("100");
        });
        it("should Not setUnlockPeriod if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).setUnlockPeriod(100)
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });

    describe("addToFeeFreeWhiteList()", async function () {
        it("should addToFeeFreeWhiteList", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.addToFeeFreeWhiteList(accounts[1]);
            const userShareRatio = await pool._userShareRatio(accounts[1])
            expect(String(userShareRatio)).to.be.equal("10000");
        });
        it("should Not addToFeeFreeWhiteList if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).addToFeeFreeWhiteList(accounts[1])
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });

    describe("removeFromFeeFreeWhiteList()", async function () {
        it("should removeFromFeeFreeWhiteList", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.addToFeeFreeWhiteList(accounts[1]);
            var userShareRatio = await pool._userShareRatio(accounts[1])
            expect(String(userShareRatio)).to.be.equal("10000");

            await pool.removeFromFeeFreeWhiteList(accounts[1]);
            var userShareRatio = await pool._userShareRatio(accounts[1])
            expect(String(userShareRatio)).to.be.equal("9900");
        });
        it("should Not removeFromFeeFreeWhiteList if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).removeFromFeeFreeWhiteList(accounts[1])
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });

    describe("setPoolName()", async function () {
        it("should setPoolName", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await pool.setPoolName("New Pool");
            const poolName = await pool.poolName()

            expect(String(poolName)).to.be.equal("New Pool");
        });
        it("should Not setPoolName if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).setPoolName("New Pool")
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });

    describe("lockForVotePower()", async function () {
        it("should lockForVotePower", async () => {
            const { pool, staking, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();
            const scfxBridge = accounts[10]
            await pool.setScfxBrdige(scfxBridge);

            await expect(
                pool.connect(scfxBridge).lockForVotePower(1, 100)
            ).to.eventually.not.be.rejected;
        });
        it("should Not lockForVotePower if not VotingEscrow contract", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).lockForVotePower(1, 100)
            ).to.rejectedWith(errorMessages.onlybridge);
        });
    });

    describe("castVote()", async function () {
        const votes = [
            {
                topic_index: 1,
                votes: [1, 2, 3],
            }
        ];

        it("should lockForVotePower", async () => {
            const { pool, staking, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();
            const scfxBridge = accounts[10]
            await pool.setScfxBrdige(scfxBridge);

            await expect(
                pool.connect(scfxBridge).castVote(1, votes)
            ).to.eventually.not.be.rejected;
        });

        it("should Not lockForVotePower if not VotingEscrow contract", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();
            const scfxBridge = accounts[10]
            await pool.setScfxBrdige(scfxBridge);

            await expect(
                pool.connect(accounts[1]).castVote(1, votes)
            ).to.rejectedWith(errorMessages.onlybridge);
        });
    });

    describe("setScfxBrdige()", async function () {
        it("should setScfxBrdige", async () => {
            const { pool, staking, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.setScfxBrdige(accounts[10])
            ).to.eventually.not.be.rejected;
        });
        it("should Not setScfxBrdige if not owner", async () => {
            const { pool, accounts, ONE_VOTE_CFX } = await registeredPoSPoolFixture();

            await expect(
                pool.connect(accounts[1]).setScfxBrdige(accounts[10])
            ).to.rejectedWith(errorMessages.onlyOwner);
        });
    });
})