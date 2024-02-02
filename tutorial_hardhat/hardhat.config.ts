import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "dotenv/config";
import "@nomiclabs/hardhat-ethers";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {},
    local: {
      url: "http://127.0.0.1:8545/",
      accounts: [process.env.PRIVATE_KEY!],
      chainId: 31337,
    },
    holesky: {
      url: process.env.RPC_URL,
      accounts: [process.env.PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY!],
    },
    mumbai: {
      url: process.env.RPC_URL_MUMBAI,
      accounts: [process.env.PRIVATE_KEY!, process.env.TEST_PRIVATE_KEY!],
    },
  },
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  gasReporter: {
    enabled: true,
    // currency: "KRW",
  },
};

export default config;
