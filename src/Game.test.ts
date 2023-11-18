import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';

import { GameCircuit, GameProof } from './Game/Circuit';
import { GameLeaderboard } from './Game/Contract';
import { GameState } from './Game/State';

import { LEFT, RIGHT } from './Game/constants';

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

  async function proveGame(runcodes: bigint[], scores?: [bigint, Field][]) {
    if (runcodes.length === 1) {
      return GameCircuit.play(
        GameState.initial(scores).operate(Field(runcodes[0])),
        Field(runcodes[0])
      );
    } else {
      let gameState = GameState.initial(scores);
      let gameStates: GameState[] = [];
      let proofs: GameProof[] = [];
      for (const runcode of runcodes) {
        gameState = gameState.operate(Field(runcode));
        gameStates.push(gameState);
        let time = Date.now();
        console.log('proving');
        proofs.push(await GameCircuit.play(gameState, Field(runcode)));
        console.log('proving done', Date.now() - time);
      }
      while (proofs.length > 1) {
        let gameStatesNew: GameState[] = [];
        let proofsNew: GameProof[] = [];
        for (let i = 0; i < proofs.length; i += 2) {
          if (i + 1 < proofs.length) {
            let gameStateFolded = gameStates[i].fold(gameStates[i + 1]);
            gameStatesNew.push(gameStateFolded);
            let time = Date.now();
            console.log('folding', i);
            proofsNew.push(
              await GameCircuit.fold(gameStateFolded, proofs[i], proofs[i + 1])
            );
            console.log('folding done', Date.now() - time);
          } else {
            gameStatesNew.push(gameStates[i]);
            proofsNew.push(proofs[i]);
          }
        }
        gameStates = gameStatesNew;
        proofs = proofsNew;
      }
      return proofs[0];
    }
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
