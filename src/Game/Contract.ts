import {
  Struct,
  PublicKey,
  Field,
  SmartContract,
  state,
  State,
  method,
} from 'o1js';
import { GameProof } from './Circuit';

export class SubmitScoreEvent extends Struct({
  player: PublicKey,
  score: Field,
}) {}

export class GameLeaderboard extends SmartContract {
  events = {
    'submit-score': SubmitScoreEvent,
  };

  @state(Field) highScore = State<Field>();

  @method submitScore(proof: GameProof) {
    // ensure valid zk proof of solution
    proof.verify();

    // ensure start states are initial
    proof.publicInput.score.prev.assertEquals(0);
    proof.publicInput.location.prev.assertEquals(0);

    // make the score public
    this.highScore.set(proof.publicInput.score.next);
    this.emitEvent(
      'submit-score',
      new SubmitScoreEvent({
        player: this.sender,
        score: proof.publicInput.score.next,
      })
    );
  }
}
