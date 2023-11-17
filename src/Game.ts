import { Field, Struct, ZkProgram } from 'o1js';

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

  update(fn: (prev: Field) => Field) {
    return new FieldPrevNext({
      prev: this.next,
      next: fn(this.next),
    });
  }
}

export class GameState extends Struct({
  score: FieldPrevNext,
  location: FieldPrevNext,
  moves: Field,
  // TODO coins
}) {
  static initial() {
    return new GameState({
      score: FieldPrevNext.default(),
      location: FieldPrevNext.default(),
      moves: Field(0),
    });
  }

  operate(opcode: Field) {
    switch (opcode.toBigInt()) {
      case STEP.UP:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.sub(N)),
          moves: this.moves.add(1),
        });
      case STEP.LEFT:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.sub(1)),
          moves: this.moves.add(1),
        });
      case STEP.RIGHT:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.add(1)),
          moves: this.moves.add(1),
        });
      case STEP.DOWN:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.add(N)),
          moves: this.moves.add(1),
        });
      default:
        throw new Error('invalid opcode');
    }
  }
}

let N = 50;

export const Game = ZkProgram({
  name: 'game',
  publicInput: GameState,
  // publicOutput: GameState,

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
  },
});
