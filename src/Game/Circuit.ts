import { Field, SelfProof, ZkProgram } from 'o1js';
import { MerkleWitnessDepth } from '../merkle-tree.js';
import { N, STEP } from './constants.js';
import { GameState } from './State.js';

export const GameCircuit = ZkProgram({
  name: 'game',
  publicInput: GameState,

  methods: {
    play: {
      privateInputs: [
        Field,
        Field,
        MerkleWitnessDepth,
        Field,
        MerkleWitnessDepth,
      ],

      method(
        publicInput: GameState,
        opcode: Field,
        score: Field,
        scoreBranch: MerkleWitnessDepth,
        claimedBefore: Field,
        claimedBranch: MerkleWitnessDepth
      ) {
        // location transition
        opcode
          .equals(Field(STEP.UP))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.sub(N))
          )
          .assertTrue();
        opcode
          .equals(Field(STEP.LEFT))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.sub(1))
          )
          .assertTrue();
        opcode
          .equals(Field(STEP.RIGHT))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.add(1))
          )
          .assertTrue();
        opcode
          .equals(Field(STEP.DOWN))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.add(N))
          )
          .assertTrue();

        // 2D grid boundary
        publicInput.location.prev.assertGreaterThanOrEqual(0);
        publicInput.location.next.assertGreaterThanOrEqual(0);
        publicInput.location.prev.assertLessThan(N * N);
        publicInput.location.next.assertLessThan(N * N);

        // constrain claimed
        claimedBefore.assertBool();
        const claimedRootBefore = claimedBranch.calculateRoot(claimedBefore);
        // claimedRootBefore.assertEquals(
        //   publicInput.claimedRoot.prev,
        //   'claimedRootBefore'
        // );
        const claimedRootAfter = claimedBranch.calculateRoot(Field(1));
        // claimedRootAfter.assertEquals(
        //   publicInput.claimedRoot.next,
        //   'claimedRootAfter'
        // );

        // constrain score
        const scoresRoot = scoreBranch.calculateRoot(score);
        scoresRoot.assertEquals(publicInput.scoresRoot);
        // if claimedBefore == 0 { prev + score == next } else {prev == next }
        claimedBefore
          .equals(Field(0))
          .and(publicInput.score.prev.add(score).equals(publicInput.score.next))
          .or(publicInput.score.prev.equals(publicInput.score.next))
          .assertTrue();
      },
    },
    fold: {
      privateInputs: [SelfProof, SelfProof],

      method(
        newState: GameState,
        earlierProof1: SelfProof<GameState, void>,
        earlierProof2: SelfProof<GameState, void>
      ) {
        // ensure zk proofs verify
        earlierProof1.verify();
        earlierProof2.verify();

        // ensure continuity
        earlierProof1.publicInput.location.next.assertEquals(
          earlierProof2.publicInput.location.prev
        );
        earlierProof1.publicInput.score.next.assertEquals(
          earlierProof2.publicInput.score.prev
        );
        earlierProof1.publicInput.moves
          .add(1)
          .assertEquals(earlierProof2.publicInput.moves);

        // constrain folded proof
        newState.location.prev.assertEquals(
          earlierProof1.publicInput.location.prev
        );
        newState.location.next.assertEquals(
          earlierProof2.publicInput.location.next
        );
        newState.score.prev.assertEquals(earlierProof1.publicInput.score.prev);
        newState.score.next.assertEquals(earlierProof2.publicInput.score.next);
      },
    },
  },
});

export let GameProof_ = ZkProgram.Proof(GameCircuit);
export class GameProof extends GameProof_ {}
