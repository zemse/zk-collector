import { Game, GameState, STEP } from './Game';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  SmartContract,
  state,
  State,
  method,
  ZkProgram,
} from 'o1js';

let proofsEnabled = false;

export let GameProof_ = ZkProgram.Proof(Game);
export class GameProof extends GameProof_ {}

class GameTest extends SmartContract {
  @state(Field) score = State<Field>();

  @method update(proof: GameProof) {
    // ensure valid zk proof of solution
    proof.verify();

    // ensure start states are initial
    proof.publicInput.score.prev.assertEquals(0);
    proof.publicInput.location.prev.assertEquals(0);

    // make the score public
    this.score.set(proof.publicInput.score.next);
  }
}

describe('Game', () => {
  let deployerAccount: PublicKey,
    deployerKey: PrivateKey,
    senderAccount: PublicKey,
    senderKey: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    zkApp: GameTest;

  beforeAll(async () => {
    await Game.compile();
    if (proofsEnabled) await GameTest.compile();
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
    zkApp = new GameTest(zkAppAddress);
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

  async function proveGame(runcodes: bigint[]) {
    if (runcodes.length === 1) {
      return Game.play(
        GameState.initial().operate(Field(runcodes[0])),
        Field(runcodes[0])
      );
    } else {
      let gameState = GameState.initial();
      let gameStates: GameState[] = [];
      let proofs: GameProof[] = [];
      for (const runcode of runcodes) {
        gameState = gameState.operate(Field(runcode));
        gameStates.push(gameState);
        let time = Date.now();
        console.log('proving');
        proofs.push(await Game.play(gameState, Field(runcode)));
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
              await Game.fold(gameStateFolded, proofs[i], proofs[i + 1])
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

  it.skip('play single step: up', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame([STEP.UP]);
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.update(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.score.get();
    expect(updatedNum).toEqual(Field(1));
  });

  it.skip('play two steps: up up', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame([STEP.UP, STEP.UP]);
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.update(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.score.get();
    expect(updatedNum).toEqual(Field(2));
  });

  it('play three steps: up up down', async () => {
    await localDeploy();

    // update transaction
    let proof = await proveGame([STEP.UP, STEP.UP, STEP.DOWN]);
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.update(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.score.get();
    expect(updatedNum).toEqual(Field(3));
  });
});
