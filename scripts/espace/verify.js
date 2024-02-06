const { address } = require("js-conflux-sdk");
async function main() {
    console.log(`Verifying contract on Etherscan...`);
    const [deployer] = await ethers.getSigners();
    const proxy1967 = await ethers.getContractAt("Proxy1967", process.env.sCFX, deployer);
    let sCFX_IMPL = await proxy1967.implementation();
    console.log(`sCFX_IMPL=${sCFX_IMPL}`);
    console.log(`MAPPED_sCFX_BRIDGE=${address.cfxMappedEVMSpaceAddress(process.env.sCFX_BRIDGE)}`);
    try {
        await hre.run(`verify:verify`, {
            address: process.env.sCFX,
            constructorArguments: [],
    });
    } catch (error) {}
    console.log(`Done for sCFX`); 
    try {
      await hre.run(`verify:verify`, {
          address: process.env.SHUI,
          constructorArguments: [],
  });
  } catch (error) {}
  console.log(`Done for SHUI`);  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});