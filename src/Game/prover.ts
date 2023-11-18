import { Field } from 'o1js';
import { GameCircuit, GameProof } from './Circuit.js';
import { GameState } from './State.js';

export async function proveGame(
  runcodes: bigint[],
  scores?: [bigint, Field][]
) {
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
