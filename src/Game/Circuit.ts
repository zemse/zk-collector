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
        collectedBefore: Field,
        collectedBranch: MerkleWitnessDepth
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

        // constrain collected
        collectedBefore.assertBool();
        const collectedRootBefore =
          collectedBranch.calculateRoot(collectedBefore);
        // collectedRootBefore.assertEquals(
        //   publicInput.collectedRoot.prev,
        //   'collectedRootBefore'
        // );
        const collectedRootAfter = collectedBranch.calculateRoot(Field(1));
        // collectedRootAfter.assertEquals(
        //   publicInput.collectedRoot.next,
        //   'collectedRootAfter'
        // );

        // constrain score
        const scoresRoot = scoreBranch.calculateRoot(score);
        scoresRoot.assertEquals(publicInput.scoresRoot);
        // if collectedBefore == 0 { prev + score == next } else {prev == next }
        collectedBefore
          .equals(Field(0))
          .and(publicInput.score.prev.add(score).equals(publicInput.score.next))
          .or(publicInput.score.prev.equals(publicInput.score.next))
          .assertTrue();

        // moves should be 1 for base proof
        publicInput.moves.assertEquals(Field(1));
      },
    },
    aggregate: {
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

        // constrain aggregated proof
        newState.location.prev.assertEquals(
          earlierProof1.publicInput.location.prev
        );
        newState.location.next.assertEquals(
          earlierProof2.publicInput.location.next
        );
        newState.score.prev.assertEquals(earlierProof1.publicInput.score.prev);
        newState.score.next.assertEquals(earlierProof2.publicInput.score.next);
        newState.moves.assertEquals(
          earlierProof1.publicInput.moves.add(earlierProof2.publicInput.moves)
        );
      },
    },
  },
});

export let GameProof_ = ZkProgram.Proof(GameCircuit);
export class GameProof extends GameProof_ {}
