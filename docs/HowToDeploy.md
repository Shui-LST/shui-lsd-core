# How to deploy

## Install
```bash
yarn
```
## Setup private key in `.env`
`cPRIVATE_KEY` is private key for Conflux Core Deployment
`ePRIVATE_KEY` is private key in Conflux eSpace Deployment
## Setup `POS_REGIST_DATA` and `POS_POOL_POS_ACCOUNT` in `.env`
Run PoS node and get returned data from:
```bash
./conflux rpc local pos register --power 1
```
The first element is `POS_REGIST_DATA` and the second is `POS_POOL_POS_ACCOUNT`
## Deploy pools and configure them including register PoS pool in Core
```bash
npx hardhat run --network cfx_test scripts/core/000_deployPool.js
```
Copy `POOL_MANAGER` `POS_POOL` `POS_POOL_IMPL` addresses into `.env` for further use
## Deploy PoS Oracle for frontend values
```bash
npx hardhat run --network cfx_test scripts/core/00_deployPoSOracle.js
```
Copy PoS Oracle address into `.env`
## Deploy sCFX bridge
```bash
npx hardhat run --network cfx_test scripts/core/01_deploysCFXBridge.js
```
Copy Proxy1967 address into `sCFX_BRIDGE` in `.env`
## Deploy sCFX and shui token and set sCFX bridge into sCFX contract in eSpace
```bash
rm -rf deployments // In case for removing previous deployments
npx hardhat run --network ecfx_test scripts/espace/01_deploy_scfx.js
npx hardhat run --network ecfx_test scripts/espace/02_deploy_shui.js
```
## Setup sCFX bridge in Core
```bash
npx hardhat run --network cfx_test scripts/core/02_setupsCFXBridge.js
```

## Deploy and setup eSpace VotingEscrow

```bash
npx hardhat run scripts/espace/03_deploy_voting_escrow.js --network ecfx_test
```

Copy VotingEscrow proxy address into `ESPACE_VOTING_ESCROW` in `.env`

```bash
npx hardhat run scripts/espace/04_set_votingEscrow_in_scfx.js --network ecfx_test
```

```bash
npx hardhat run scripts/core/04_setupsCFXBridge_2.js --network cfx_test
```

# Maintainance and Monitoring
In server, run the PoS node
and run the following tasks
```bash
npx hardhat run --network cfx_test services/handlesCFXCrossTasks.js
```
and
```bash
npx hardhat run --network cfx_test services/seedPosOracleData.js
```