import { lstat } from "fs";

class Arg {
  constructor(private _id: any) {}

  get id() {
    return this._id;
  }

  get rest() {
    return new RestArg(this);
  }
}

class Binding {
  constructor(public expr: Expr, public match: MatchSet) {}
}

class RestArg {
  constructor(public arg: Arg) {}
}

function allocArgs() {}

type Immutable = undefined | null | boolean | number | string | symbol;

type Expr =
  | Immutable
  | Arg
  | RestArg
  | ArrayView<Expr>
  | Expr[]
  | { [key: string]: Expr };

type Stmt = readonly [string, ...Expr[]];

const TRUE = ["true"] as const;

class Facts {
  facts = [];
  add(statement: Stmt, condition: Stmt = TRUE) {
    this.facts.push({ statement, condition });
    return this;
  }
  *test(statement) {}
}

interface Match {
  has(arg: Arg): boolean;
  get(arg: Arg): any;
}

interface MatchSet extends Match {
  set(arg: Arg, value: any): this;
  delete(arg: Arg): this;
}

class MatchEmpty implements Match {
  has(arg: Arg) {
    return false;
  }
  get(arg: Arg) {
    return undefined;
  }
}

const empty = new MatchEmpty();

class MatchChain implements Match {
  constructor(private left: Match, private right: Match) {}
  has(arg: Arg) {
    return this.left.has(arg) || this.right.has(arg);
  }
  get(arg: Arg) {
    if (!this.has(arg)) {
      return new Binding(arg, this);
    }
    if (this.left.has(arg)) {
      return this.left.get(arg);
    }
    return this.right.get(arg);
  }
}

class MatchMap implements MatchSet {
  map = new Map();
  constructor() {}
  has(arg: Arg): boolean {
    return this.map.has(arg);
  }
  get(arg: Arg) {
    if (!this.has(arg)) {
      return new Binding(arg, this);
    }
    return this.map.get(arg);
  }
  set(arg: Arg, value: undefined) {
    this.map.set(arg, value);
    return this;
  }
  delete(arg: Arg) {
    this.map.delete(arg);
    return this;
  }
}

class Machine {
  implementations = [];
  impl(
    implementation: (
      statement: Stmt,
      facts: Facts,
      match: Match
    ) => Iterator<any>
  ) {
    this.implementations.push(implementation);
    return this;
  }
  *test(statement: Stmt, facts: Facts, match: Match) {
    for (const impl of this.implementations) {
      yield* impl(statement, facts, match);
    }
  }
}

class FactSlice<T> {
  constructor(public array: T[], public index: number) {}
  get(index: number) {
    return this.array[this.index + index];
  }
  slice(index: number) {
    return new FactSlice(this.array, this.index + index);
  }
  isEmpty() {
    return this.array.length - this.index === 0;
  }
  static isSlice<T>(maybeSlice: unknown): maybeSlice is FactSlice<T> {
    return maybeSlice instanceof FactSlice;
  }
}

const matchers = [
  function* (a, ma, b, mb, match) {
    if (a === b) {
      yield ma;
    }
  },
  function* (a, ma, b, mb, match) {
    if (a instanceof Arg) {
      if (ma.has(a)) {
        yield* match(ma.get(a), ma, b, mb, match);
      } else {
        try {
          ma.set(a, mb.get(b));
          yield ma;
        } finally {
          ma.delete(a);
        }
      }
      yield false;
    }
  },
  function* (a, ma, b, mb, match) {
    if (b instanceof Arg) {
      if (mb.has(b)) {
        yield* match(a, ma, mb.get(b), mb, match);
      } else {
        try {
          mb.set(b, ma.get(a));
          yield ma;
        } finally {
          mb.delete(b);
        }
      }
      yield false;
    }
  },
  function* (a, ma, b, mb, match) {
    if (Array.isArray(a)) {
      if (Array.isArray(b)) {
        yield* match(new FactSlice(a, 0), ma, new FactSlice(b, 0), mb, match);
      } else if (FactSlice.isSlice(b)) {
        yield* match(new FactSlice(a, 0), ma, b, mb, match);
      }
      yield false;
    }
  },
  function* (a, ma, b, mb, match) {
    if (FactSlice.isSlice(a)) {
      if (FactSlice.isSlice(b)) {
        if (a.isEmpty() && b.isEmpty()) {
          yield ma;
        } else if (!a.isEmpty() && a.get(0) instanceof RestArg) {
          yield* match((a.get(0) as RestArg).arg, ma, b, mb, match);
        } else if (!b.isEmpty() && b.get(0) instanceof RestArg) {
          yield* match(a, ma, (b.get(0) as RestArg).arg, mb, match);
        } else if (!a.isEmpty() && !b.isEmpty()) {
          for (const matched of match(a.get(0), ma, b.get(0), mb, match)) {
            if (matched === false) {
              yield false;
              return;
            }
            yield* match(a.slice(1), ma, b.slice(1), mb, match);
          }
        }
      }
      yield false;
    }
  },
  function* (a, ma, b, mb, match) {
    if (typeof a === "object") {
    }
  },
];

class ArrayView<T> {
  constructor(public array: T[], public index: number) {}
  isEmpty() {
    return this.index === this.array.length;
  }
  get(index: number) {
    return this.array[this.index + index];
  }
  slice(index: number) {
    return new ArrayView(this.array, this.index + index);
  }
  static of<T>(array: T[]) {
    return new ArrayView(array, 0);
  }
  static isArrayView(
    maybeArrayView: unknown
  ): maybeArrayView is ArrayView<unknown> {
    return maybeArrayView instanceof ArrayView;
  }
}

function* match(a, ma, b, mb) {
  for (const matcher of matchers) {
    for (const map of matcher(a, ma, b, mb, match)) {
      if (map === false) {
        return;
      }
    }
  }
}

{
  const [a, b, a2, b2, a3, b3] = allocArgs();
  const f = new Facts()
    .add(["_=", a, b], ["_,", ["_same", a, b], ["_cut"]])
    .add(["_=", a, b], ["_,", ["_set", a, b], ["_cut"]])
    .add(["_=", a, b], ["_,", ["_set", b, a], ["_cut"]])
    .add(["_=", a, b], ["_,", ["_empty", a], ["_,", ["_empty", b], ["_cut"]]])
    .add(
      ["_=", a, b],
      [
        "_,",
        ["_first", a, a2, a3],
        [
          "_,",
          ["_first", b, b2, b3],
          ["_,", ["_=", a2, b2], ["_,", ["_=", a3, b3], ["_cut"]]],
        ],
      ]
    )
    .add(
      ["_=", a, b],
      [
        "_,",
        ["_key", a, a2, a3, a4],
        [
          "_,",
          ["_key", b, b2, b3, b4],
          [
            "_,",
            ["_same", a2, b2],
            ["_,", ["_=", a3, b3], ["_,", ["_=", a4, b4], ["_cut"]]],
          ],
        ],
      ]
    );

  const m = new Machine().impl(function* (statement, facts, match) {
    if (Array.isArray(statement) && statement.length === 3) {
      const [left, op, right] = statement;
      if (op === "_=") {
        if (left === right) {
          yield match;
        } else if (
          Array.isArray(left) &&
          Array.isArray(right) &&
          left.length === right.length
        ) {
          yield* m.test(
            [ArrayView.of(left), "_=", ArrayView.of(right)],
            facts,
            match
          );
        } else if (
          ArrayView.isArrayView(left) &&
          ArrayView.isArrayView(right)
        ) {
          if (left.isEmpty()) {
            yield match;
          } else {
            for (const _ of m.test(
              [left.get(0), "_=", right.get(0)],
              facts,
              match
            )) {
              yield* m.test(
                [left.slice(1), "_=", right.slice(1)],
                facts,
                match
              );
            }
          }
        }
      }
    }
  });
}
function last(left: Expr[]) {
  return left[left.length - 1];
}
