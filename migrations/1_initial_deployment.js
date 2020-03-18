const PEGStableCoin = artifacts.require("PEG");
const FakeMedianiser = artifacts.require("Medianiser");

module.exports = function (deployer) {

  deployer.deploy(FakeMedianiser, "0x00000000000000000000000000000000000000000000000ca6cc517ff0aa0000").then(
    DeployedFakeMedianiser => deployer.deploy(PEGStableCoin, DeployedFakeMedianiser.address, 60 * 60, { value: 10 ** 18 })
  )

};
