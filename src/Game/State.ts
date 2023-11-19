import { Struct, Field } from 'o1js';
import { DEPTH, N, STEP } from './constants.js';
import { MerkleTreeWrapper } from '../merkle-tree.js';

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
  collectedRoot: FieldPrevNext,
  score: FieldPrevNext,
  location: FieldPrevNext,
  moves: Field,
}) {
  scoresTree: MerkleTreeWrapper;
  collectedTree: MerkleTreeWrapper;

  constructor(
    obj: any,
    scoresTree: MerkleTreeWrapper,
    collectedTree: MerkleTreeWrapper
  ) {
    // console.log(obj.score.prev.toBigInt(), obj.score.next.toBigInt());
    super(obj);
    this.scoresTree = scoresTree;
    this.collectedTree = collectedTree;
  }

  static initial(scores?: [bigint, Field][]) {
    const scoresTree = new MerkleTreeWrapper(DEPTH);
    const collectedTree = new MerkleTreeWrapper(DEPTH);

    for (const score of scores ?? []) {
      scoresTree.set(score[0], score[1]);
    }

    return new GameState(
      {
        scoresRoot: scoresTree.build().getRoot(),
        collectedRoot: FieldPrevNext.from(collectedTree.build().getRoot()),
        score: FieldPrevNext.default(),
        location: FieldPrevNext.default(),
        moves: Field(1),
      },
      scoresTree.clone(),
      collectedTree.clone()
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

    let scoresTree = this.scoresTree.clone();
    let collectedTree = this.collectedTree.clone();

    const iscollected =
      (collectedTree.get(location.next.toBigInt()) ?? Field(0)).toBigInt() ===
      1n;
    newScore =
      (!iscollected ? scoresTree.get(location.next.toBigInt()) : undefined) ??
      Field(0);
    // console.log('loc', location.next.toBigInt(), 'score', newScore.toBigInt());
    collectedTree.set(location.next.toBigInt(), Field(1));
    return new GameState(
      {
        scoresRoot: this.scoresRoot,
        collectedRoot: this.collectedRoot.update(() =>
          collectedTree.build().getRoot()
        ),
        score: this.score.update((s) => s.add(newScore)),
        location,
        moves: Field(1),
      },
      scoresTree,
      collectedTree
    );
  }

  aggregate(nextGameState: GameState) {
    return new GameState(
      {
        scoresRoot: this.scoresRoot,
        collectedRoot: this.collectedRoot,
        score: new FieldPrevNext({
          prev: this.score.prev,
          next: nextGameState.score.next,
        }),
        location: new FieldPrevNext({
          prev: this.location.prev,
          next: nextGameState.location.next,
        }),
        moves: this.moves.add(nextGameState.moves),
      },
      this.scoresTree.clone(),
      this.collectedTree.clone()
    );
  }
}
