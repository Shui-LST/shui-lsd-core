const { ethers } = require("hardhat");
const { address } = require("js-conflux-sdk");
async function main() {

    const { deploy } = deployments;
    const [deployer] = await ethers.getSigners();
    let deploytx = await deploy("sCFX", {
        from: deployer.address,
        args: [],
        log: true,
        proxy: {
            proxyContract: "Proxy1967",
            proxyArgs: ["{implementation}", "0x8129fc1c"],
        },
    });
    console.log(`sCFX proxy deployed at: ${deploytx.address}. Impl at: ${deploytx.implementation}`);
    const scfx = await ethers.getContractAt("sCFX", deploytx.address, deployer);
    let tx = await scfx.setmappedsCFXBridge(
        address.cfxMappedEVMSpaceAddress(process.env.sCFX_BRIDGE)
    );
    await tx.wait();    
    console.log(`set scfx core bridge ${address.cfxMappedEVMSpaceAddress(process.env.sCFX_BRIDGE)}`);
    tx = await scfx.renounceRole(
        "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", //MINTER ROLE
        deployer.address
    );
    await tx.wait();  
    console.log(`Renounce MINTER ROLE for ${deployer.address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });