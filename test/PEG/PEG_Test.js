// Based on token testing by ConsenSys
const { assertRevert } = require("../helpers/assertRevert");

const PEG_Abstraction = artifacts.require("PEG");
const FakeMedianiser = artifacts.require("Medianiser");
let PEG;
const medianiser_value =
  "0x" +
  web3.utils
    .toHex(web3.utils.toWei("200")) // Assume 1 Ether = $200
    .substr(2)
    .padStart(64, "0");

function pegify(n) {
  return web3.utils.toBN(web3.utils.toWei(n.toString()));
}

contract("PEG", accounts => {
  beforeEach(async () => {
    let Medianiser = await FakeMedianiser.new(medianiser_value, {
      from: accounts[0]
    });
    PEG = await PEG_Abstraction.new(Medianiser.address, 60 * 60, {
      from: accounts[0],
      value: web3.utils.toWei("100")
    });
    await PEG.getPEG({ from: accounts[0], value: web3.utils.toWei("100") });
  });

  // prop_peg = (contrib/(pool+contrib)), prop_peg * pool + prop_peg * contrib = contrib,
  // prop_peg * pool = contrib - prop_peg * contrib, prop_peg * pool = contrib * (1 - prop_peg), contrib = (prop_peg * pool) / (1 - prop_peg)
  it("creation: should create an initial pool of 20,000 PEG, and owner then gets 10,000 PEG by giving 100 ETH", async () => {
    const pool_balance = await PEG.balanceOf.call(PEG.address);
    const owner_balance = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(pool_balance, pegify(10000));
    assert.deepStrictEqual(owner_balance, pegify(10000));
  });

  it("creation: test correct setting of vanity information", async () => {
    const name = await PEG.name.call();
    assert.strictEqual(name, "PEG Stablecoin");

    const decimals = await PEG.decimals.call();
    assert.strictEqual(decimals.toNumber(), 18);

    const symbol = await PEG.symbol.call();
    assert.strictEqual(symbol, "PEG");
  });

  // TRANSERS
  it("transfers: should transfer 10000 PEG to accounts[1] with accounts[0] having 10000 PEG", async () => {
    await PEG.transfer(accounts[1], pegify(10000), { from: accounts[0] });
    const balance1 = await PEG.balanceOf.call(accounts[1]);
    assert.deepStrictEqual(balance1, pegify(10000));
    const balance0 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(0));
  });

  it("transfers: should fail when trying to transfer 10001 to accounts[1] with accounts[0] having 10000", async () => {
    await assertRevert(
      PEG.transfer.call(accounts[1], pegify(10001), { from: accounts[0] })
    );
  });

  it("transfers: should handle zero-transfers normally", async () => {
    assert(
      await PEG.transfer.call(accounts[1], 0, { from: accounts[0] }),
      "zero-transfer has failed"
    );
  });

  // APPROVALS
  it("approvals: msg.sender should approve 100 to accounts[1]", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance, pegify(100));
  });

  // bit overkill. But is for testing a bug
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 20 once.", async () => {
    const balance0 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(10000));

    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] }); // 100
    const balance2 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(0), "balance2 not correct");

    await PEG.transferFrom.call(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    });
    await PEG.allowance.call(accounts[0], accounts[1]);
    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    }); // =20
    const allowance01 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(80)); // =80

    const balance22 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance22, pegify(20));

    const balance02 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance02, pegify(9980));
  });

  // should approve 100 of msg.sender & withdraw 50, twice. (should succeed)
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 20 twice.", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance01 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(100));

    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    });
    const allowance012 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance012, pegify(80));

    const balance2 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(20));

    const balance0 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(9980));

    // FIRST tx done.
    // onto next.
    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    });
    const allowance013 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance013, pegify(60));

    const balance22 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance22, pegify(40));

    const balance02 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance02, pegify(9960));
  });

  // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 50 & 60 (2nd tx should fail)", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance01 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(100));

    await PEG.transferFrom(accounts[0], accounts[2], pegify(50), {
      from: accounts[1]
    });
    const allowance012 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance012, pegify(50));

    const balance2 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(50));

    const balance0 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(9950));

    // FIRST tx done.
    // onto next.
    await assertRevert(
      PEG.transferFrom.call(accounts[0], accounts[2], pegify(60), {
        from: accounts[1]
      })
    );
  });

  it("approvals: attempt withdrawal from account with no allowance (should fail)", async () => {
    await assertRevert(
      PEG.transferFrom.call(accounts[0], accounts[2], pegify(60), {
        from: accounts[1]
      })
    );
  });

  it("approvals: allow accounts[1] 100 to withdraw from accounts[0]. Withdraw 60 and then approve 0 & attempt transfer.", async () => {
    await PEG.approve(accounts[1], 100, { from: accounts[0] });
    await PEG.transferFrom(accounts[0], accounts[2], 60, { from: accounts[1] });
    await PEG.approve(accounts[1], 0, { from: accounts[0] });
    await assertRevert(
      PEG.transferFrom.call(accounts[0], accounts[2], 10, { from: accounts[1] })
    );
  });

  it("approvals: approve max (2^256 - 1)", async () => {
    const max =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await PEG.approve(accounts[1], max, { from: accounts[0] });
    const allowance = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance.toString(), max);
  });

  // should approve max of msg.sender & withdraw 20 without changing allowance (should succeed).
  it("approvals: msg.sender approves accounts[1] of max (2^256 - 1) & withdraws 20", async () => {
    const balance0 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(10000));

    const max =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await PEG.approve(accounts[1], max, { from: accounts[0] });
    const balance2 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(0), "balance2 not correct");

    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    });
    const allowance01 = await PEG.allowance.call(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01.toString(), max);

    const balance22 = await PEG.balanceOf.call(accounts[2]);
    assert.deepStrictEqual(balance22, pegify(20));

    const balance02 = await PEG.balanceOf.call(accounts[0]);
    assert.deepStrictEqual(balance02, pegify(9980));
  });

  it("events: should fire Transfer event properly", async () => {
    const res = await PEG.transfer(accounts[1], pegify(2666), {
      from: accounts[0]
    });
    const transferLog = res.logs.find(element =>
      element.event.match("Transfer")
    );
    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.deepStrictEqual(transferLog.args.tokens, pegify(2666));
  });

  it("events: should fire Transfer event normally on a zero transfer", async () => {
    const res = await PEG.transfer(accounts[1], pegify(0), {
      from: accounts[0]
    });
    const transferLog = res.logs.find(element =>
      element.event.match("Transfer")
    );
    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.deepStrictEqual(transferLog.args.tokens, pegify(0));
  });

  it("events: should fire Approval event properly", async () => {
    const res = await PEG.approve(accounts[1], pegify(2666), {
      from: accounts[0]
    });
    const approvalLog = res.logs.find(element =>
      element.event.match("Approval")
    );
    assert.strictEqual(approvalLog.args.owner, accounts[0]);
    assert.strictEqual(approvalLog.args.spender, accounts[1]);
    assert.deepStrictEqual(approvalLog.args.tokens, pegify(2666));
  });
});
