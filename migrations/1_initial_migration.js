const Migrations = artifacts.require("Migrations");

module.exports = function (deployer, network) {
  if (network.indexOf("mainnet") == -1) deployer.deploy(Migrations);
};
