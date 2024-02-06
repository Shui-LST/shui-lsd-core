/* eslint-disable no-unused-vars */
/* eslint-disable node/no-unpublished-require */
/* eslint-disable prettier/prettier */
require('dotenv').config();
const {conflux, Drip, account} = require("./init");
const poolContractInfo = require("../../artifacts/contracts/core/PoSPool.sol/PoSPool.json");
const poolProxyInfo = require("../../artifacts/contracts/utils/Proxy1967.sol/Proxy1967.json");

 // 0x8129fc1c - initialize
const InitializeMethodData = '0x8129fc1c';

async function main() {
  // TODO read regist data from config file
  const posRegistData = process.env.POS_REGIST_DATA;
  if (!posRegistData) {
    console.log("Please input posRegistData");
    return;
  }
  
  const poolContract = conflux.Contract({
    abi: poolContractInfo.abi,
    bytecode: poolContractInfo.bytecode,
  });

  console.log("======== Start deploying pool...");
  const deployPoolReceipt = await poolContract
    .constructor()
    .sendTransaction({
      from: account.address,
    })
    .executed();

  if (deployPoolReceipt.outcomeStatus !== 0) {
    console.log("Deploy pool failed");
    return;
  }
  console.log(
    "Deploy pool success, address is: ",
    deployPoolReceipt.contractCreated
  );

  console.log("======== Start deploying pool proxy...");
  const poolProxyContract = conflux.Contract({
    abi: poolProxyInfo.abi,
    bytecode: poolProxyInfo.bytecode,
  });
  const deployProxyContract = await poolProxyContract
    .constructor(deployPoolReceipt.contractCreated, InitializeMethodData)
    .sendTransaction({
      from: account.address,
    })
    .executed();

  if (deployProxyContract.outcomeStatus !== 0) {
    console.log("Deploy pool proxy failed");
    return;
  }
  console.log(
    "Deploy pool proxy success, address is: ",
    deployProxyContract.contractCreated
  );

  console.log("======== Start register pool...");
  
  /* poolContract = conflux.Contract({
    abi: poolContractInfo.abi,
    bytecode: deployProxyContract.contractCreated,
  }); */

  const registerPoolReceipt = await conflux.cfx
    .sendTransaction({
      from: account.address,
      value: Drip.fromCFX(1000),
      to: deployProxyContract.contractCreated,
      data: posRegistData,
    })
    .executed();
  if (registerPoolReceipt.outcomeStatus !== 0) {
    console.log("Pool register failed");
    return;
  }
  console.log("Pool register successed");

  console.log(`POS_POOL=${deployProxyContract.contractCreated}`);
  console.log(`POS_POOL_IMPL=${deployPoolReceipt.contractCreated}`);
  console.log("Pool deploy successed");
}

main().catch(console.log);
