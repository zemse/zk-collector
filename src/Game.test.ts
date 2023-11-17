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

  async function proveGame(runcode: bigint[]) {
    if (runcode.length === 1) {
      return Game.play(
        GameState.initial().operate(Field(runcode[0])),
        Field(runcode[0])
      );
    } else {
      throw new Error('recursion not yet implemented');
    }
  }

  it('play single step: up', async () => {
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
});
