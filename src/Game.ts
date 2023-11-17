import { Field, Struct, ZkProgram } from 'o1js';

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
      case 1n:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.sub(N)),
          moves: this.moves.add(1),
        });
      case 2n:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.sub(1)),
          moves: this.moves.add(1),
        });
      case 3n:
        return new GameState({
          score: this.score.update((s) => s.add(1)),
          location: this.location.update((l) => l.add(1)),
          moves: this.moves.add(1),
        });
      case 4n:
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

      // opcode: 1 -> up, 2 -> left, 3 -> right, 4 -> down
      method(publicInput: GameState, opcode: Field) {
        // opcode
        //   .equals(Field(1))
        //   .not()
        //   .or(
        //     publicInput.location.next.equals(publicInput.location.prev.sub(N))
        //   ) // TODO prevent overflow
        //   .assertTrue();
        // opcode
        //   .equals(Field(2))
        //   .not()
        //   .or(
        //     publicInput.location.next.equals(publicInput.location.prev.sub(1))
        //   ) // TODO prevent overflow
        //   .assertTrue();
        // opcode
        //   .equals(Field(3))
        //   .not()
        //   .or(
        //     publicInput.location.next.equals(publicInput.location.prev.add(1))
        //   ) // TODO prevent overflow
        //   .assertTrue();
        // opcode
        //   .equals(Field(4))
        //   .not()
        //   .or(
        //     publicInput.location.next.equals(publicInput.location.prev.add(N))
        //   ) // TODO prevent overflow
        //   .assertTrue();
      },
    },
  },
});
