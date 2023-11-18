import { Field, MerkleTree } from 'o1js';

// just for the ability to clone a merkle tree
export class MerkleTreeWrapper {
  depth: number;
  values: { [key: string]: Field };

  constructor(depth: number, values?: { [key: number]: Field }) {
    this.depth = depth;
    this.values = values ?? [];
  }

  set(index: bigint, value: Field) {
    this.values[index.toString()] = value;
  }

  get(index: bigint): Field | undefined {
    return this.values[index.toString()];
  }

  build() {
    let tree = new MerkleTree(this.depth);
    for (const [index, value] of Object.entries(this.values)) {
      tree.setLeaf(BigInt(index), value);
    }
    return tree;
  }

  clone() {
    return new MerkleTreeWrapper(this.depth, { ...this.values });
  }
}
