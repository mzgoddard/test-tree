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
    *call(statement) {
      const scope = new MatchMap();
      for (const _ of _call(viewOf(scope, statement), this)) {
        yield scope;
      }
    }
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
        return new ArgView(this as unknown as MatchSet, arg);
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
        return new ArgView(this, arg);
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

  type TypeOfExpr<T extends Expr | View> = T extends undefined
    ? "undefined"
    : T extends null
    ? "null"
    : T extends number
    ? "number"
    : T extends string
    ? "string"
    : T extends symbol
    ? "symbol"
    : T extends Arg
    ? "arg"
    : T extends RestArg
    ? "restArg"
    : T extends any[]
    ? "array"
    : T extends View
    ? "view"
    : T extends { [key: string]: any }
    ? "object"
    : never;

  function _typeOf<T extends Expr | View>(value: T): TypeOfExpr<T>;
  function _typeOf(value: Expr) {
    if (typeof value === "object") {
      if (value === null) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      } else if (value instanceof Arg) {
        return "arg";
      } else if (value instanceof RestArg) {
        return "restArg";
      } else if (value instanceof View) {
        return "view";
      }
      return "object";
    }
    return typeof value;
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
    : T;
  function viewOf<T extends Expr | View>(match: MatchSet, target: T): ViewOf<T>;
  function viewOf(match: MatchSet, target: Expr | View) {
    switch (_typeOf(target)) {
      case "array":
        return new ArrayView(match, target as Expr[], 0);
      case "object":
        return new ObjectView(
          match,
          target as { [key in string | symbol]: Expr }
        );
      case "arg":
        return new ArgView(match, target as Arg).get();
      case "view":
        return target as unknown as View;
      default:
        return target as Immutable;
    }
  }
  function serialize(value: Immutable | View) {
    if (value instanceof View) {
      return value.serialize();
    }
    return value;
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
    abstract serialize(): any;
  }
  class ArgView extends View {
    constructor(public match: MatchSet, public target: Arg) {
      super();
    }
    isArg(): this is ArgView {
      return true;
    }
    serialize() {
      const value = this.get();
      if (value instanceof View) {
        if (value.isArg()) {
          return value.target;
        }
        return value.serialize();
      }
      return value;
    }
    bound() {
      return this.match.has(this.target);
    }
    get(): Immutable | View {
      if (!this.match.has(this.target)) {
        return this;
      }
      const value = this.match.get(this.target) as Immutable | View;
      if (value === this) {
        throw new Error("Cannot evaluate to self.");
      } else if (value instanceof ArgView) {
        return value.get();
      }
      return value;
    }
    set(value: Immutable | View) {
      if (
        value instanceof ArgView &&
        value.match === this.match &&
        value.target === this.target
      ) {
        throw new Error("Cannot evaluate to self.");
      }
      this.match.set(this.target, value);
    }
    delete() {
      this.match.delete(this.target);
    }
    *guard(value: Immutable | View) {
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
    serialize() {
      return this.target.slice(this.start).map((entry) => {
        if (entry instanceof RestArg) {
          return new ArgView(this.match, entry.arg).serialize();
        }
        const view = viewOf(this.match, entry as Expr);
        if (view instanceof View) {
          return view.serialize();
        }
        return view;
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
    first() {
      return viewOf(this.match, this.target[this.start] as Expr);
    }
    rest() {
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
    serialize() {
      return this.keys.target.slice(this.keys.start).reduce((carry, key) => {
        const view = viewOf(this.match, this.target[key]);
        if (view instanceof View) {
          carry[key] = view.serialize();
        } else {
          carry[key] = view;
        }
        return carry;
      }, {});
    }
    first() {
      return viewOf(this.match, this.target[this.keys.first() as string]);
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
    serialize() {
      return this.value;
    }
  }

  function* _unify<S extends Immutable | View, T extends Immutable | View>(
    left: S,
    right: T
  ) {
    if ((left as Immutable | View) === (right as Immutable | View)) {
      yield true;
    }
    if (left instanceof View) {
      if (left.isArg()) {
        if (left.bound()) {
          yield* _unify(left.get(), right);
        } else if (
          right instanceof ArgView &&
          left.target === right.target &&
          left.match === right.match
        ) {
          yield true;
        } else {
          for (const _ of left.guard(right)) {
            yield true;
          }
        }
      } else if (right instanceof ArgView) {
        for (const _ of _unify(right, left)) {
          yield true;
        }
      } else if (left.isArray() && right instanceof ArrayView) {
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
      } else if (left.isObject() && right instanceof ObjectView) {
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
    } else if (right instanceof View) {
      for (const _ of _unify(right, left)) {
        yield true;
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

  const [params] = args();
  const llOps: [
    (Expr | RestArg)[],
    (statement: ArrayView, facts: Facts) => Generator<boolean>
  ][] = [
    [
      [",", ...params],
      function* _comma(statement, facts) {
        const scope = statement.match;
        const [left, right] = args();
        for (const _ of _unify(
          viewOf(scope, [left, right]),
          viewOf(scope, params)
        )) {
          for (const _ of _call(scope.get(left), facts)) {
            yield* _call(scope.get(right), facts);
          }
        }
      },
    ],
    [
      [";", ...params],
      function* _comma(statement, facts) {
        const scope = statement.match;
        const [left, right] = args();
        for (const _ of _unify(
          viewOf(scope, [left, right]),
          viewOf(scope, params)
        )) {
          yield* _call(scope.get(left), facts);
          yield* _call(scope.get(right), facts);
        }
      },
    ],
    [
      ["=", ...params],
      function* _assign(statement, facts) {
        const scope = statement.match;
        const [left, right] = args();
        for (const _ of _unify(
          viewOf(scope, [left, right]),
          viewOf(scope, params)
        )) {
          yield* _unify(viewOf(scope, left), viewOf(scope, right));
        }
      },
    ],
    [
      ["is", ...params],
      function* _settle(statement, facts) {
        const scope = statement.match;
        const [left, right] = args();
        for (const _ of _unify(
          viewOf(scope, [left, right]),
          viewOf(scope, params)
        )) {
          let leftFormula = scope.get(left);
          if (leftFormula instanceof ArgView) {
            leftFormula = leftFormula.get();
          }
          let rightFormula = scope.get(right);
          if (rightFormula instanceof ArgView) {
            rightFormula = rightFormula.get();
          }
          const leftValue =
            leftFormula instanceof ArrayView
              ? calc(serialize(leftFormula))
              : leftFormula;
          const rightValue =
            rightFormula instanceof ArrayView
              ? calc(serialize(rightFormula))
              : rightFormula;
          yield* _unify(leftValue, rightValue);
        }
      },
    ],
    [
      ["true", ...params],
      function* _true(statement, facts) {
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
      function* _log(statement, facts) {
        console.log(...serialize(viewOf(statement.match, params)));
        yield true;
      },
    ],
  ];

  function* _call(statement: ArrayView, facts: Facts) {
    const scope = new MatchMap();
    for (const [llOp, llAction] of llOps) {
      for (const _ of _unify(viewOf(scope, llOp), statement)) {
        yield* llAction(viewOf(scope, llOp), facts);
        return;
      }
    }

    try {
      for (const fact of facts.facts) {
        for (const _ of _unify(viewOf(scope, fact.statement), statement)) {
          yield* _call(viewOf(scope, fact.condition), facts);
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
      viewOf(m, [",", ["get", [1, 2, 3, 4], ..._0], ["true"]]),
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
