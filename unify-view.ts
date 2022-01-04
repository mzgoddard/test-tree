{
  type Immutable = undefined | null | boolean | number | string | symbol;

  type Expr =
    | Immutable
    | Arg
    | ArrayView<Expr | RestArg>
    | (Expr | RestArg)[]
    | { [key: string]: Expr };

  type Storable = Immutable | View;

  type Stmt = readonly [string, ...Expr[]];

  class Arg {
    constructor(private _id?: any) {}

    get id() {
      return this._id;
    }

    get rest() {
      return new RestArg(this);
    }

    *[Symbol.iterator]() {
      yield this.rest;
    }
  }

  const MAX_NEW_ARGS = 32;
  let nextGlobalArgId = 0;
  function* args() {
    let i = 0;
    for (; i < MAX_NEW_ARGS; i++) {
      yield new Arg(nextGlobalArgId++);
    }
    throw new Error(`Created too many (${i}) args.`);
  }

  class RestArg {
    constructor(public arg: Arg) {}
  }

  const TRUE = ["true"] as const;

  class Facts {
    facts = [];
    add(statement: Stmt, condition: Stmt = TRUE) {
      this.facts.push({ statement, condition });
      return this;
    }
    *test(statement) {}
    *call(statement: [string, ...Expr[]]) {
      const scope = new MatchMap();
      for (const _ of _call(new ArrayView(scope, statement, 0), this)) {
        yield scope;
      }
    }
  }

  interface Match {
    has(arg: Arg): boolean;
    get(arg: Arg): View;
  }

  interface MatchSet extends Match {
    set(arg: Arg, value: View): this;
    delete(arg: Arg): this;
  }

  class MatchMap implements MatchSet {
    map = new Map();
    constructor() {}
    has(arg: Arg): boolean {
      return this.map.has(arg);
    }
    get(arg: Arg) {
      if (!this.has(arg)) {
        return new ArgView(this, arg);
      }
      return this.map.get(arg);
    }
    set(arg: Arg, value: View) {
      this.map.set(arg, value);
      return this;
    }
    delete(arg: Arg) {
      this.map.delete(arg);
      return this;
    }
  }

  type ViewOf<T extends Expr | View> = T extends Arg
    ? ArgView
    : T extends (infer R)[]
    ? R extends Expr
      ? ArrayView<R>
      : ArrayView<Expr>
    : T extends { [key: string]: infer R }
    ? R extends Expr
      ? ObjectView<R>
      : ObjectView<Expr>
    : T extends Immutable
    ? ImmutableView<T>
    : never;

  function viewOf<T extends Expr | View>(match: MatchSet, target: T): ViewOf<T>;
  function viewOf(match: MatchSet, target: Expr | View) {
    if (target instanceof View) {
      return target;
    } else if (typeof target === "object") {
      if (target === null) {
        return new ImmutableView(match, target as null);
      } else if (Array.isArray(target)) {
        return new ArrayView(match, target, 0);
      } else if (target instanceof Arg) {
        return new ArgView(match, target);
      } else {
        return new ObjectView(match, target);
      }
    } else {
      return new ImmutableView(match, target);
    }
  }

  function serialize(value: View) {
    return value.serialize();
  }

  abstract class View {
    match: MatchSet;
    isArg(): this is ArgView {
      return false;
    }
    isArray(): this is ArrayView<any> {
      return false;
    }
    isObject(): this is ObjectView<any> {
      return false;
    }
    isImmutable(): this is ImmutableView<any> {
      return false;
    }
    abstract isSame(other: View): boolean;
    abstract serialize(): any;
  }
  class ArgView extends View {
    constructor(public match: MatchSet, public target: Arg) {
      super();
    }
    isArg(): this is ArgView {
      return true;
    }
    isSame(other: View) {
      return (
        other.isArg() &&
        other.match === this.match &&
        other.target === this.target
      );
    }
    serialize() {
      const value = this.get();
      if (value.isArg()) {
        return value.target;
      }
      return value.serialize();
    }
    bound() {
      return this.match.has(this.target);
    }
    get(): View {
      if (!this.match.has(this.target)) {
        return this;
      }
      const value = this.match.get(this.target) as View;
      if (value.isArg()) {
        return value.get();
      }
      return value;
    }
    set(value: View) {
      if (value.isSame(this)) {
        throw new Error("Cannot evaluate to self.");
      }
      this.match.set(this.target, value);
    }
    delete() {
      this.match.delete(this.target);
    }
    *guard(value: View) {
      this.set(value);
      try {
        yield this.match;
      } finally {
        this.delete();
      }
    }
  }

  class ArrayView<T extends Expr | RestArg = Expr | RestArg> extends View {
    constructor(
      public match: MatchSet,
      public target: T[],
      public start: number
    ) {
      super();
    }
    isArray(): this is ArrayView<Expr> {
      return true;
    }
    isSame(other: View) {
      return (
        other.isArray() &&
        other.match === this.match &&
        other.target === this.target &&
        other.start === this.start
      );
    }
    serialize() {
      return this.target.slice(this.start).map((entry) => {
        if (entry instanceof RestArg) {
          return new ArgView(this.match, entry.arg).serialize();
        }
        return viewOf(this.match, entry as Expr).serialize();
      });
    }
    empty() {
      return (
        this.target.length === this.start ||
        this.target[this.start] instanceof RestArg
      );
    }
    more() {
      return this.target[this.start] instanceof RestArg;
    }
    first(): View {
      return viewOf(this.match, this.target[this.start] as Expr);
    }
    rest(): View {
      if (this.target[this.start] instanceof RestArg) {
        return new ArgView(
          this.match,
          (this.target[this.start] as RestArg).arg
        ).get();
      } else if (this.target[this.start + 1] instanceof RestArg) {
        return new ArgView(
          this.match,
          (this.target[this.start + 1] as RestArg).arg
        ).get();
      }
      return new ArrayView(this.match, this.target, this.start + 1);
    }
  }

  class ObjectView<V extends Expr> extends View {
    constructor(
      public match: MatchSet,
      public target: { [key in string | symbol]: V },
      public keys = new ArrayView(match, Object.keys(target).sort(), 0)
    ) {
      super();
    }
    isObject(): this is ObjectView<Expr> {
      return true;
    }
    isSame(other: View) {
      return (
        other.isObject() &&
        other.match === this.match &&
        other.target === this.target &&
        (other.keys.isSame(this.keys) ||
          other.keys.target.every((key, index) => key === this.keys[index]))
      );
    }
    serialize() {
      return this.keys.target.slice(this.keys.start).reduce((carry, key) => {
        carry[key] = viewOf(this.match, this.target[key]).serialize();
        return carry;
      }, {});
    }
    first() {
      return viewOf(this.match, this.target[this.keys.first().serialize()]);
    }
    rest() {
      return new ObjectView(
        this.match,
        this.target,
        this.keys.rest() as ArrayView<string>
      );
    }
  }

  class ImmutableView<T extends Immutable = Immutable> extends View {
    constructor(public match: MatchSet, public value: T) {
      super();
    }
    isImmutable() {
      return true;
    }
    isSame(other: View) {
      return other.isImmutable() && other.value === this.value;
    }
    serialize() {
      return this.value;
    }
  }

  function* _unify<S extends View, T extends View>(left: S, right: T) {
    if (left.isSame(right)) {
      yield true;
    } else if (left.isArg()) {
      if (left.bound()) {
        yield* _unify(left.get(), right);
      } else {
        for (const _ of left.guard(right)) {
          yield true;
        }
      }
    } else if (right.isArg()) {
      for (const _ of _unify(right, left)) {
        yield true;
      }
    } else if (left.isArray() && right.isArray()) {
      if (!left.empty() && !right.empty()) {
        for (const _ of _unify(left.first(), right.first())) {
          yield* _unify(left.rest(), right.rest());
        }
      } else if (left.empty() && left.more()) {
        yield* _unify(left.rest(), right);
      } else if (right.empty() && right.more()) {
        yield* _unify(left, right.rest());
      } else if (left.empty() && right.empty()) {
        yield true;
      }
    } else if (left.isObject() && right.isObject()) {
      if (left.keys.empty() && right.keys.empty()) {
        yield true;
      } else if (!left.keys.empty() && !right.keys.empty()) {
        if (left.keys.first() === right.keys.first()) {
          for (const _ of _unify(left.first(), right.first())) {
            yield* _unify(left.rest(), right.rest());
          }
        }
      }
    }
  }

  class CutError extends Error {}

  function calc(formula) {
    let [op, left, right] = formula;
    if (Array.isArray(left)) {
      left = calc(left as ["string", any, any]);
    } else if (Array.isArray(right)) {
      right = calc(right as ["string", any, any]);
    }
    switch (op) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return left / right;
      default:
        throw new Error(`Cannot calculate ${JSON.stringify(formula)}.`);
    }
  }

  const [params, left, right] = args();
  const llOps: [
    (Expr | RestArg)[],
    (statement: ArrayView, facts: Facts) => Generator<boolean>
  ][] = [
    [
      [",", left, right],
      function* _comma(statement, facts) {
        const scope = statement.match;
        for (const _ of _call(scope.get(left) as ArrayView<any>, facts)) {
          yield* _call(scope.get(right) as ArrayView<any>, facts);
        }
      },
    ],
    [
      [";", left, right],
      function* _comma(statement, facts) {
        const scope = statement.match;
        yield* _call(scope.get(left) as ArrayView<any>, facts);
        yield* _call(scope.get(right) as ArrayView<any>, facts);
      },
    ],
    [
      ["=", left, right],
      function* _assign(statement, facts) {
        const scope = statement.match;
        yield* _unify(scope.get(left), scope.get(right));
      },
    ],
    [
      ["is", left, right],
      function* _settle(statement, facts) {
        const scope = statement.match;
        let leftFormula = scope.get(left);
        if (leftFormula.isArg()) {
          leftFormula = leftFormula.get();
        }
        let rightFormula = scope.get(right);
        if (rightFormula.isArg()) {
          rightFormula = rightFormula.get();
        }
        const leftValue = leftFormula.isArray()
          ? new ImmutableView(leftFormula.match, calc(serialize(leftFormula)))
          : leftFormula;
        const rightValue = rightFormula.isArray()
          ? new ImmutableView(rightFormula.match, calc(serialize(rightFormula)))
          : rightFormula;
        yield* _unify(leftValue, rightValue);
      },
    ],
    [
      ["true", ...params],
      function* _true() {
        yield true;
      },
    ],
    [
      ["cut", ...params],
      function* _cut() {
        yield true;
        throw new CutError();
      },
    ],
    [
      ["log", ...params],
      function* _log(statement) {
        console.log(...serialize(statement.match.get(params)));
        yield true;
      },
    ],
  ];

  function* _call(statement: ArrayView, facts: Facts) {
    const scope = new MatchMap();
    for (const [llOp, llAction] of llOps) {
      const llOpView = new ArrayView(scope, llOp, 0);
      for (const _ of _unify(llOpView, statement)) {
        yield* llAction(llOpView, facts);
        return;
      }
    }

    try {
      for (const fact of facts.facts) {
        for (const _ of _unify(
          new ArrayView(scope, fact.statement, 0),
          statement
        )) {
          yield* _call(new ArrayView(scope, fact.condition, 0), facts);
        }
      }
    } catch (err) {
      if (err instanceof CutError) {
        return;
      }
      throw err;
    }
  }

  {
    const [_0, _1, _2, _3, _4] = args();
    const m = new MatchMap();
    const n = new MatchMap();
    for (const _ of _unify(viewOf(m, [1, _0]), viewOf(n, [_1, _1, ..._2]))) {
      console.log(
        serialize(viewOf(m, [_0, _1, _2])),
        serialize(viewOf(n, [_0, _1, _2]))
      );
    }
    for (const _ of _call(
      viewOf(m, [",", ["value", _0, ..._1], ["log", _0, _1]]),
      new Facts().add(["value", 1]).add(["value", 2])
    )) {
    }
    const start = process.hrtime.bigint
      ? process.hrtime.bigint()
      : process.hrtime();
    // const startMs = Date.now();
    for (const _ of _call(
      viewOf(m, [
        ",",
        [
          "get",
          [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20,
          ],
          ..._0,
        ],
        ["true"],
      ]),
      new Facts().add(
        ["get", [_0, ..._1], _2, _3],
        [
          ";",
          [",", ["is", _2, 0], ["=", _3, _0]],
          [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
        ]
      )
    )) {
    }
    console.log(
      ((process.hrtime.bigint
        ? process.hrtime.bigint()
        : process.hrtime()) as any) - (start as any)
      // Date.now() - startMs
    );
    for (const _ of new Facts()
      .add(
        ["get", [_0, ..._1], _2, _3],
        [
          ";",
          [",", ["is", _2, 0], ["=", _3, _0]],
          [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
        ]
      )
      .call([",", ["get", [1, 2, 3, 4], ..._0], ["log", _0]])) {
    }
    for (const _ of new Facts()
      .add(
        ["get", [_0, ..._1], _2, _3],
        [
          ";",
          [",", ["is", _2, 0], ["=", _3, _0]],
          [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
        ]
      )
      .call([",", ["get", [1, 2, 3, 4], _0, 2], ["log", _0]])) {
    }
    for (const _ of new Facts()
      .add(
        ["get", [_0, ..._1], _2, _3],
        [
          ";",
          [",", ["is", _2, 0], ["=", _3, _0]],
          [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
        ]
      )
      .call([",", ["get", [1, 2, 3, 4], 2, _0], ["log", _0]])) {
    }
    // [
    //   _2,
    //   "is",
    //   0,
    //   ",",
    //   _3,
    //   "=",
    //   _0,
    //   ";",
    //   ["get", _1, _4, _3],
    //   ",",
    //   [_2, "is", _4, "+", 1],
    // ];
    // [
    //   ["rewrite", _0, _0],
    //   [",", ["=", [_1, ..._2], _0], [",", ["isString", _1], ["cut"]]],
    // ];
    // [
    //   ["rewrite", [_0, _1, ",", ..._2], _3],
    //   [",", ["rewrite", []]],
    // ];
    // [["rewrite", [_0, "is", _1], ["is", _0, _1]]];
    // [["rewrite", [_0, ",", _1], [",", _0, _1]]];
    // [["rewrite", [_0, "is", _1], ["is", _0, _1]]];
    // [["rewrite", [_0, "=", _1], ["=", _0, _1]]];
    // [["rewrite", _0, _0]];
  }
}
