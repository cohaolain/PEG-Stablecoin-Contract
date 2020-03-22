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

  context("creation:", () => {
    it("should create an initial pool of 20,000 PEG, and owner then gets 10,000 PEG by giving 100 ETH", async () => {
    const pool_balance = await PEG.balanceOf(PEG.address);
    const owner_balance = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(pool_balance, pegify(10000));
    assert.deepStrictEqual(owner_balance, pegify(10000));
  });

    it("test correct setting of vanity information", async () => {
    const name = await PEG.name();
    assert.strictEqual(name, "PEG Stablecoin");

    const decimals = await PEG.decimals();
    assert.strictEqual(decimals.toNumber(), 18);

    const symbol = await PEG.symbol();
    assert.strictEqual(symbol, "PEG");
  });
  });

  context("transfers:", () => {
    it("should transfer 10,000 PEG to accounts[1] with accounts[0] having 10,000 PEG", async () => {
    await PEG.transfer(accounts[1], pegify(10000), { from: accounts[0] });
    const balance1 = await PEG.balanceOf(accounts[1]);
    assert.deepStrictEqual(balance1, pegify(10000));
    const balance0 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(0));
  });

    it("should fail when trying to transfer 10,001 PEG to accounts[1] with accounts[0] having 10,000 PEG", async () => {
    await assertRevert(
      PEG.transfer(accounts[1], pegify(10001), { from: accounts[0] })
    );
  });

    it("should handle zero-transfers normally", async () => {
    assert(
      await PEG.transfer(accounts[1], 0, { from: accounts[0] }),
      "zero-transfer has failed"
    );
  });

    it("should fail when trying to transfer to the 0 address", async () => {
    await assertRevert(
      PEG.transfer("0x0000000000000000000000000000000000000000", pegify(1), {
        from: accounts[0]
      })
    );
  });
  });

  context("approvals:", () => {
    it("should approve 100 PEG allowance to accounts[1]", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance, pegify(100));
  });

  // bit overkill. But is for testing a bug
    it("should withdraw 20 PEG with 100 PEG allowance, leave 80 PEG allowance", async () => {
    const balance0 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(10000));

    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] }); // 100
    const balance2 = await PEG.balanceOf(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(0), "balance2 not correct");

    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    }); // =20

    const allowance01 = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(80)); // =80

    const balance22 = await PEG.balanceOf(accounts[2]);
    assert.deepStrictEqual(balance22, pegify(20));

    const balance02 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance02, pegify(9980));
  });

    it("should withdraw 50 PEG twice with 100 PEG allowance, leaving 0 PEG allowance", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance01 = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(100));

      await PEG.transferFrom(accounts[0], accounts[2], pegify(50), {
      from: accounts[1]
    });
    const allowance012 = await PEG.allowance(accounts[0], accounts[1]);
      assert.deepStrictEqual(allowance012, pegify(50));

    const balance2 = await PEG.balanceOf(accounts[2]);
      assert.deepStrictEqual(balance2, pegify(50));

    const balance0 = await PEG.balanceOf(accounts[0]);
      assert.deepStrictEqual(balance0, pegify(9950));

    // FIRST tx done.
    // onto next.
      await PEG.transferFrom(accounts[0], accounts[2], pegify(50), {
      from: accounts[1]
    });
    const allowance013 = await PEG.allowance(accounts[0], accounts[1]);
      assert.deepStrictEqual(allowance013, pegify(0));

    const balance22 = await PEG.balanceOf(accounts[2]);
      assert.deepStrictEqual(balance22, pegify(100));

    const balance02 = await PEG.balanceOf(accounts[0]);
      assert.deepStrictEqual(balance02, pegify(9900));
  });

    it("should fail to withdraw 50, 60 PEG consecutively with starting allowance of 100 PEG", async () => {
    await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
    const allowance01 = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01, pegify(100));

    await PEG.transferFrom(accounts[0], accounts[2], pegify(50), {
      from: accounts[1]
    });
    const allowance012 = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance012, pegify(50));

    const balance2 = await PEG.balanceOf(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(50));

    const balance0 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(9950));

    // FIRST tx done.
    // onto next.
    await assertRevert(
      PEG.transferFrom(accounts[0], accounts[2], pegify(60), {
        from: accounts[1]
      })
    );
  });

    it("should fail to withdraw from account with no allowance", async () => {
    await assertRevert(
      PEG.transferFrom(accounts[0], accounts[2], pegify(60), {
        from: accounts[1]
      })
    );
  });

    it("should allow accounts[1] 100 PEG to withdraw from accounts[0] and withdraw 60 PEG, then set allowance to 0 and fail on withdrawal of 10 PEG.", async () => {
      await PEG.approve(accounts[1], pegify(100), { from: accounts[0] });
      await PEG.transferFrom(accounts[0], accounts[2], pegify(60), {
        from: accounts[1]
      });
    await PEG.approve(accounts[1], 0, { from: accounts[0] });
    await assertRevert(
        PEG.transferFrom(accounts[0], accounts[2], pegify(10), {
          from: accounts[1]
        })
    );
  });

    it("should approve max allowance (2^256 - 1)", async () => {
    const max =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await PEG.approve(accounts[1], max, { from: accounts[0] });
    const allowance = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance.toString(), max);
  });

    it("should not decrement allowance on withdrawal if msg.sender has max allowance", async () => {
    const balance0 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance0, pegify(10000));

    const max =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    await PEG.approve(accounts[1], max, { from: accounts[0] });
    const balance2 = await PEG.balanceOf(accounts[2]);
    assert.deepStrictEqual(balance2, pegify(0), "balance2 not correct");

    await PEG.transferFrom(accounts[0], accounts[2], pegify(20), {
      from: accounts[1]
    });
    const allowance01 = await PEG.allowance(accounts[0], accounts[1]);
    assert.deepStrictEqual(allowance01.toString(), max);

    const balance22 = await PEG.balanceOf(accounts[2]);
    assert.deepStrictEqual(balance22, pegify(20));

    const balance02 = await PEG.balanceOf(accounts[0]);
    assert.deepStrictEqual(balance02, pegify(9980));
  });
  });

  context("events:", () => {
    it("should fire Transfer event properly", async () => {
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

    it("should fire Transfer event normally on a zero transfer", async () => {
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

    it("should fire Approval event properly", async () => {
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

    it("should fire Burn, Transfer events on burn", async () => {
    const res = await PEG.burn(pegify(50), { from: accounts[0] });
      const burnLog = await res.logs.find(element =>
        element.event.match("Burn")
      );
    const transferLog = await res.logs.find(element =>
      element.event.match("Transfer")
    );

    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(
      transferLog.args.to,
      "0x0000000000000000000000000000000000000000"
    );
    assert.deepStrictEqual(transferLog.args.tokens, pegify(50));
    assert.strictEqual(burnLog.args.owner, accounts[0]);
    assert.deepStrictEqual(burnLog.args.tokens, pegify(50));
  });
});

  context("burn:", () => {
    it("should decrease balance and total supply", async () => {
      await PEG.burn(pegify(50), { from: accounts[0] });
      const totalSupply = await PEG.totalSupply();
      const balance = await PEG.balanceOf(accounts[0]);
      assert.deepStrictEqual(pegify(9950), balance);
      assert.deepStrictEqual(pegify(19950), totalSupply);
    });
  });
