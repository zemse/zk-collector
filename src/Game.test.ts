import { Game, GameState } from './Game';
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

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

let proofsEnabled = false;

export let GameProof_ = ZkProgram.Proof(Game);
export class GameProof extends GameProof_ {}

class GameTest extends SmartContract {
  @state(Field) score = State<Field>();

  @method update(proof: GameProof) {
    proof.verify();
    // TODO check if the game prev states are initial

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

  //   it('generates and deploys the `Add` smart contract', async () => {
  //     await localDeploy();
  //     const num = zkApp.num.get();
  //     expect(num).toEqual(Field(1));
  //   });

  it('play', async () => {
    await localDeploy();

    // update transaction
    let proof = await Game.play(
      GameState.initial().operate(Field(3)),
      Field(3)
    );
    // console.log(JSON.stringify(proof));
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.update(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();

    const updatedNum = zkApp.score.get();
    // console.log(updatedNum.toBigInt());
    expect(updatedNum).toEqual(Field(1));
  });
});
