import {
  Field,
  PublicKey,
  SelfProof,
  SmartContract,
  State,
  Struct,
  ZkProgram,
  method,
  state,
} from 'o1js';
import { MerkleTreeWrapper } from '../merkle-tree';
import { N, STEP } from './constants';
import { GameState } from './State';

export const GameCircuit = ZkProgram({
  name: 'game',
  publicInput: GameState,

  methods: {
    play: {
      privateInputs: [Field], // opcode

      method(publicInput: GameState, opcode: Field) {
        opcode
          .equals(Field(STEP.UP))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.sub(N))
          ) // TODO prevent overflow
          .assertTrue();
        opcode
          .equals(Field(STEP.LEFT))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.sub(1))
          ) // TODO prevent overflow
          .assertTrue();
        opcode
          .equals(Field(STEP.RIGHT))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.add(1))
          ) // TODO prevent overflow
          .assertTrue();
        opcode
          .equals(Field(STEP.DOWN))
          .not()
          .or(
            publicInput.location.next.equals(publicInput.location.prev.add(N))
          ) // TODO prevent overflow
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