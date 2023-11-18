import { Field, SelfProof, Struct, ZkProgram } from 'o1js';
import { MerkleTreeWrapper } from './merkle-tree';

export const N = 50;

export const STEP = {
  UP: 1n,
  LEFT: 2n,
  RIGHT: 3n,
  DOWN: 4n,
};

class FieldPrevNext extends Struct({
  prev: Field,
  next: Field,
}) {
  static default() {
    return new FieldPrevNext({
      prev: Field(0),
      next: Field(0),
    });
  }

  static from(val: Field) {
    return new FieldPrevNext({
      prev: Field(val),
      next: Field(val),
    });
  }

  update(fn: (prev: Field) => Field) {
    return new FieldPrevNext({
      prev: this.next,
      next: fn(this.next),
    });
  }
}

export class GameState extends Struct({
  scoresRoot: Field,
  claimedRoot: FieldPrevNext,
  score: FieldPrevNext,
  location: FieldPrevNext,
  moves: Field,
}) {
  scoresTree: MerkleTreeWrapper;
  claimedTree: MerkleTreeWrapper;

  constructor(
    obj: any,
    scoresTree: MerkleTreeWrapper,
    claimedTree: MerkleTreeWrapper
  ) {
    // console.log(obj.score.prev.toBigInt(), obj.score.next.toBigInt());
    super(obj);
    this.scoresTree = scoresTree;
    this.claimedTree = claimedTree;
  }

  static initial(scores?: [bigint, Field][]) {
    const scoresTree = new MerkleTreeWrapper(Math.ceil(Math.log2(N * N)));
    const claimedTree = new MerkleTreeWrapper(Math.ceil(Math.log2(N * N)));

    for (const score of scores ?? []) {
      scoresTree.set(score[0], score[1]);
    }

    return new GameState(
      {
        scoresRoot: scoresTree.build().getRoot(),
        claimedRoot: FieldPrevNext.from(claimedTree.build().getRoot()),
        score: FieldPrevNext.default(),
        location: FieldPrevNext.default(),
        moves: Field(0),
      },
      scoresTree.clone(),
      claimedTree.clone()
    );
  }

  operate(opcode: Field) {
    let newScore: Field;
    let location: FieldPrevNext;
    switch (opcode.toBigInt()) {
      case STEP.UP:
        location = this.location.update((l) => l.sub(N));
        break;
      case STEP.LEFT:
        location = this.location.update((l) => l.sub(1));
        break;
      case STEP.RIGHT:
        location = this.location.update((l) => l.add(1));
        break;
      case STEP.DOWN:
        location = this.location.update((l) => l.add(N));
        break;
      default:
        throw new Error('invalid opcode');
    }
    const isClaimed =
      (
        this.claimedTree.get(location.next.toBigInt()) ?? Field(0)
      ).toBigInt() === 1n;
    newScore =
      (!isClaimed
        ? this.scoresTree.get(location.next.toBigInt())
        : undefined) ?? Field(0);
    // console.log('loc', location.next.toBigInt(), 'score', newScore.toBigInt());
    this.claimedTree.set(location.next.toBigInt(), Field(1));
    return new GameState(
      {
        scoresRoot: this.scoresRoot,
        claimedRoot: this.claimedRoot.update(() =>
          this.claimedTree.build().getRoot()
        ),
        score: this.score.update((s) => s.add(newScore)),
        location,
        moves: this.moves.add(1),
      },
      this.scoresTree.clone(),
      this.claimedTree.clone()
    );
  }

  fold(nextGameState: GameState) {
    return new GameState(
      {
        scoresRoot: this.scoresRoot,
        claimedRoot: this.claimedRoot,
        score: new FieldPrevNext({
          prev: this.score.prev,
          next: nextGameState.score.next,
        }),
        location: new FieldPrevNext({
          prev: this.location.prev,
          next: nextGameState.location.next,
        }),
        moves: nextGameState.moves,
      },
      this.scoresTree.clone(),
      this.claimedTree.clone()
    );
  }
}

export const Game = ZkProgram({
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
