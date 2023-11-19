import { Field } from 'o1js';
import { GameCircuit, GameProof } from './Circuit.js';
import { GameState } from './State.js';
import { DEPTH } from './constants.js';

export async function proveGame(
  runcodes: bigint[],
  scores?: [bigint, Field][]
) {
  if (runcodes.length === 1) {
    let gameState = GameState.initial(scores);
    let [collected, collectedBranch] = gameState.collectedTree.getWitness(
      gameState.location.next.toBigInt()
    );
    gameState = gameState.operate(Field(runcodes[0]));
    let [score, scoreBranch] = gameState.scoresTree.getWitness(
      gameState.location.next.toBigInt()
    );
    console.log({
      score: score.toBigInt(),
      scoreBranch,
      collected: collected.toBigInt(),
      collectedBranch,
    });
    return GameCircuit.play(
      gameState,
      Field(runcodes[0]),
      score,
      scoreBranch,
      collected,
      collectedBranch
    );
  } else {
    let gameState = GameState.initial(scores);
    let gameStates: GameState[] = [];
    let proofs: GameProof[] = [];
    for (const runcode of runcodes) {
      let collectedTreePrev = gameState.collectedTree;
      gameState = gameState.operate(Field(runcode));
      let [collected, collectedBranch] = collectedTreePrev.getWitness(
        gameState.location.next.toBigInt()
      );
      let [score, scoreBranch] = gameState.scoresTree.getWitness(
        gameState.location.next.toBigInt()
      );
      console.log({
        collectedTreePrev,
        score: score.toBigInt(),
        // scoreBranch,
        collected: collected.toBigInt(),
        // collectedBranch,
      });
      gameStates.push(gameState);
      let time = Date.now();
      console.log('proving');
      proofs.push(
        await GameCircuit.play(
          gameState,
          Field(runcode),
          score,
          scoreBranch,
          collected,
          collectedBranch
        )
      );
      console.log('proving done', Date.now() - time);
    }
    while (proofs.length > 1) {
      let gameStatesNew: GameState[] = [];
      let proofsNew: GameProof[] = [];
      for (let i = 0; i < proofs.length; i += 2) {
        if (i + 1 < proofs.length) {
          let gameStateAggregated = gameStates[i].aggregate(gameStates[i + 1]);
          gameStatesNew.push(gameStateAggregated);
          let time = Date.now();
          console.log('aggregating', i);
          proofsNew.push(
            await GameCircuit.aggregate(
              gameStateAggregated,
              proofs[i],
              proofs[i + 1]
            )
          );
          console.log('aggregating done', Date.now() - time);
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
