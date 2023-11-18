import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';

import { GameCircuit, GameProof } from './Game/Circuit';
import { GameLeaderboard } from './Game/Contract';
import { GameState } from './Game/State';

import { DOWN, LEFT, RIGHT, UP } from './Game/constants';
import { proveGame } from './Game/prover';

let proofsEnabled = false;

describe('Game', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: GameLeaderboard;

  beforeAll(async () => {
    await GameCircuit.compile();
    if (proofsEnabled) await GameLeaderboard.compile();
  });

  beforeEach(() => {
    const Local = Mina.LocalBlockchain({ proofsEnabled });
    Mina.setActiveInstance(Local);
    ({ privateKey: deployerKey, publicKey: deployerAccount } =
      Local.testAccounts[0]);
    ({ privateKey: senderKey, publicKey: senderAccount } =
      Local.testAccounts[1]);
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkApp = new GameLeaderboard(zkAppAddress);
  });

  async function localDeploy() {
    const txn = await Mina.transaction(deployerAccount, () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      zkApp.deploy();
    });
    await txn.prove();
    // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
    await txn.sign([deployerKey, zkAppPrivateKey]).send();
  }

  // TODO make it work for up as well (needs working out the map)
  it('play single step: right', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame([RIGHT], [[1n, Field(20)]]);
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.submitScore(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.highScore.get();
    expectEqual(updatedNum, Field(20));
  });

  it('play two steps: right right', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame(
      [RIGHT, RIGHT],
      [
        [1n, Field(20)],
        [2n, Field(15)],
        [3n, Field(5)],
      ]
    );
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.submitScore(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.highScore.get();
    expectEqual(updatedNum, Field(35));
  });

  it('play three steps: right right left - does not count revisited cells', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame(
      [RIGHT, RIGHT, LEFT],
      [
        [1n, Field(20)],
        [2n, Field(15)],
        [3n, Field(5)],
      ]
    );
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.submitScore(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.highScore.get();
    expectEqual(updatedNum, Field(35));
  });

  it.only('play multiple steps: right down right left up - does not count revisited cells', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame(
      [RIGHT, DOWN, RIGHT, LEFT, UP, RIGHT, LEFT],
      [
        [1n, Field(20)],
        [2n, Field(15)],
        [3n, Field(5)],
        [51n, Field(5)],
      ]
    );
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.submitScore(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.highScore.get();
    expectEqual(updatedNum, Field(40));
  });
});

function expectEqual(a: Field, b: Field) {
  try {
    // doesnt throw helpful error Field when not equal
    expect(a).toEqual(b);
  } catch {
    throw new Error(
      `expected field ${a.toBigInt()} to equal field ${b.toBigInt()}`
    );
  }
}
