import { Field, Mina, PrivateKey, PublicKey, AccountUpdate } from 'o1js';
import express from 'express';

import { GameLeaderboard } from './Game/Contract.js';
import { GameCircuit, GameProof } from './Game/Circuit.js';
import { proveGame } from './Game/prover.js';
import { STEP } from './Game/constants.js';

const PORT = 1234;
const treasure_map = [
  [1n, Field(20)],
  [2n, Field(15)],
  [3n, Field(5)],
] as [bigint, Field][];

let deployerAccount: PublicKey,
  deployerKey: PrivateKey,
  senderAccount: PublicKey,
  senderKey: PrivateKey,
  zkAppAddress: PublicKey,
  zkAppPrivateKey: PrivateKey,
  zkApp: GameLeaderboard;

async function setupLocalChain() {
  console.log('compiling zkApp...');
  await GameCircuit.compile();
  await GameLeaderboard.compile();

  const Local = Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);

  ({ privateKey: deployerKey, publicKey: deployerAccount } =
    Local.testAccounts[0]);
  ({ privateKey: senderKey, publicKey: senderAccount } = Local.testAccounts[1]);

  zkAppPrivateKey = PrivateKey.random();
  zkAppAddress = zkAppPrivateKey.toPublicKey();
  zkApp = new GameLeaderboard(zkAppAddress);

  console.log('deploying zkApp...');
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    zkApp.deploy();
  });
  await txn.prove();
  // this tx needs .sign(), because `deploy()` adds an account update that requires signature authorization
  await txn.sign([deployerKey, zkAppPrivateKey]).send();

  console.log('leaderboard zkapp deployed at: ' + zkAppAddress.toBase58());
}

await setupLocalChain();
const app = express();

app.get('/leaderboard-address', (_, response) => {
  response.send(zkAppAddress.toBase58());
});

const provings: Promise<GameProof>[] = [];
const resolved = new Map<number, boolean>();
app.get('/prove', (request, response) => {
  // proveGame()
  console.log(request.query.solution);
  let solution: bigint[];
  try {
    solution = parseSolution(request.query.solution as string);
  } catch (e) {
    console.error(e);
    response.send((e as any).message);
    return;
  }

  const provePromise = proveGame(solution, treasure_map);
  let id = provings.length;
  provings.push(provePromise);
  provePromise.finally(() => resolved.set(id, true));
  response.send(id);
});

app.get('/submit', async (request, response) => {
  const id = Number(request.query.id);
  let done = resolved.get(id);
  if (!done) {
    response.send('generating proof please wait');
  } else {
    let proof = await provings[id];
    const txn = await Mina.transaction(senderAccount, () => {
      zkApp.submitScore(proof);
    });
    await txn.prove();
    await txn.sign([senderKey]).send();
    response.send(
      'successfully submitted score: ' +
        proof.publicInput.score.next.toBigInt().toString()
    );
  }
});

app.listen(PORT, () => {
  console.log(`Listen on the port ${PORT}...`);
});

function parseSolution(solution: string): bigint[] {
  let opcodes = [];

  for (let i = 0; i < solution.length; i++) {
    try {
      let parsed = BigInt(solution[i]);
      if (!Object.values(STEP).includes(parsed)) {
        throw new Error();
      }
      opcodes.push(parsed);
    } catch {
      throw new Error('invalid opcode ' + solution[i]);
    }
  }

  return opcodes;
}
