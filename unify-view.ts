import { threadId } from "worker_threads";

export type Immutable = undefined | null | boolean | number | string | symbol;

export type Expr =
  | Immutable
  | Arg
  | (Expr | RestArg)[]
  | ({ [key: string]: Expr } & { [objectRestKeySymbol]?: Arg });
export type ArrayExpr<
  T extends [] | Expr[] | (Expr | RestArg)[] = [] | Expr[] | (Expr | RestArg)[]
> = T;
export type ObjectExpr<
  O extends { [key: string]: Expr } = { [key: string]: Expr }
> = O & { [objectRestKeySymbol]?: Arg };

export type Stmt = [string, ...ArrayExpr];

const objectRestKey = "__UNIFY_VIEW__OBJECT_REST_KEY";
const objectRestKeySymbol = Symbol.for(objectRestKey);

export class Arg {
  constructor(private _id?: number, private _debugId?: any) {}

  get id() {
    return this._id;
  }

  get debugId() {
    return this._debugId;
  }

  get rest() {
    return new RestArg(this);
  }

  toJSON() {
    return `Arg(_${this._debugId})`;
  }

  *[Symbol.iterator]() {
    yield this.rest;
  }
}

export class RestArg {
  constructor(public arg: Arg) {}
}

const MAX_NEW_ARGS = 32;
let nextGlobalArgId = 0;
export function* args(...ids: any[]) {
  let i = 0;
  for (; i < MAX_NEW_ARGS; i++) {
    yield new Arg(ids[i], nextGlobalArgId++);
  }
  throw new Error(`Created too many (${i}) args.`);
}

export const TRUE = ["true"] as [string];

export class Facts {
  facts = [] as { statement: Stmt; condition: Stmt }[];
  add(statement: Stmt, condition: Stmt = TRUE) {
    this.facts.push({ statement, condition });
    return this;
  }
  *call(statement: [string, ...ArrayExpr]) {
    const scope = new MatchMap();
    for (const _ of _call(ViewFactory.array(scope, statement, 0), this)) {
      yield scope;
    }
  }
}

export interface Match {
  has(arg: Arg): boolean;
  get(arg: Arg): View;
  serialize(view?: View): any;
}

export interface MatchSet extends Match {
  set(arg: Arg, value: View): this;
  delete(arg: Arg): this;
}

export class MatchMap implements MatchSet {
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
  serialize(value?: Expr | View) {
    if (value === undefined) {
      return Array.from(this.map.entries()).reduce(
        (carry, [arg, view], index) => {
          carry[arg.id || `_${index}`] = view.serialize();
          return carry;
        },
        {}
      );
    }
    return serialize(ViewFactory.view(this, value));
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

type ViewOf<T extends Expr | View> = T extends View
  ? T
  : T extends Arg
  ? ArgView
  : T extends Expr[]
  ? ArrayView<T>
  : T extends (Expr | RestArg)[]
  ? View
  : T extends { [key: string]: Expr }
  ? ObjectView<T>
  : T extends Immutable
  ? ImmutableView<T>
  : never;

export function serialize(value: View) {
  return value.serialize();
}

function decycle(view: View, value: any, cycleMap: Map<View, any>) {}

export abstract class View {
  context: MatchSet;
  isArg(): this is ArgView {
    return false;
  }
  isArray(): this is ArrayView {
    return false;
  }
  isObject(): this is ObjectView {
    return false;
  }
  isImmutable(): this is ImmutableView {
    return false;
  }
  abstract isSame(other: View): boolean;
  abstract serialize(cycleMap?: Map<View, any>): any;
  abstract copyTo(context: MatchSet): View;
  abstract unify(other: View): Generator<boolean>;
}
export class ViewFactory {
  static view<T extends Expr | View, R extends View = ViewOf<T>>(
    match: MatchSet,
    target: T
  ): R;
  static view(match: MatchSet, target: Expr | View): View {
    if (target instanceof View) {
      return target;
    } else if (typeof target === "object") {
      if (target === null) {
        return new ImmutableView(match, target as null);
      } else if (Array.isArray(target)) {
        return ViewFactory.array(match, target, 0);
      } else if (target instanceof Arg) {
        return ViewFactory.arg(match, target);
      } else {
        return new ObjectView(match, target as ObjectExpr);
      }
    } else {
      return new ImmutableView(match, target as Immutable);
    }
  }
  static arg(match: MatchSet, target: Arg): View {
    if (match.has(target)) {
      const view = match.get(target);
      if (view.isArg()) {
        return view.get();
      }
    }
    return new ArgView(match, target);
  }
  static array<T extends [Expr, ...ArrayExpr]>(
    match: MatchSet,
    target: T,
    index: 0
  ): ArrayView<T>;
  static array<T extends ArrayExpr, R = ViewOf<T>>(
    match: MatchSet,
    target: T,
    index: number
  ): R;
  static array<T extends ArrayExpr>(match: MatchSet, target: T, index: number) {
    if (target.length === index) {
      return new EmptyArrayView(match, target, index);
    } else if (target[index] instanceof RestArg) {
      return ViewFactory.arg(match, (target[index] as RestArg).arg);
    }
    return new IndexArrayView(match, target, index);
  }
}
export class ArgView extends View {
  constructor(public context: MatchSet, public target: Arg) {
    super();
  }
  isArg(): this is ArgView {
    return true;
  }
  isSame(other: View) {
    return (
      other.isArg() &&
      other.context === this.context &&
      other.target === this.target
    );
  }
  serialize(cycleMap = new Map()) {
    if (!cycleMap.has(this)) {
      const value = this.get();
      if (value.isArg()) {
        cycleMap.set(this, value);
      } else {
        cycleMap.set(this, value.serialize(cycleMap));
      }
    }
    return cycleMap.get(this);
  }
  copyTo(context: MatchSet) {
    if (this.context.has(this.target)) {
      context.set(this.target, this.context.get(this.target).copyTo(context));
    }
    return new ArgView(context, this.target);
  }
  *unify(other: View): Generator<boolean> {
    if (
      other.isArg() &&
      other.context === this.context &&
      other.target === this.target
    ) {
      yield true;
    } else if (this.bound()) {
      yield* this.get().unify(other);
    } else {
      yield* this.guard(other);
    }
  }
  bound() {
    return this.context.has(this.target);
  }
  get(): View {
    if (!this.context.has(this.target)) {
      return this;
    }
    const value = this.context.get(this.target) as View;
    if (value.isArg()) {
      return value.get();
    }
    return value;
  }
  set(value: View) {
    if (value.isSame(this)) {
      throw new Error("Cannot evaluate to self.");
    }
    this.context.set(this.target, value);
  }
  delete() {
    this.context.delete(this.target);
  }
  *guard(value: View) {
    this.set(value);
    try {
      yield true;
    } finally {
      this.delete();
    }
  }
}

export class ArrayView<T extends ArrayExpr = ArrayExpr> extends View {
  constructor(
    public context: MatchSet,
    public target: T,
    public start: number
  ) {
    super();
  }
  isArray(): this is ArrayView {
    return true;
  }
  isSame(other: View) {
    return (
      other.isArray() &&
      other.context === this.context &&
      other.target === this.target &&
      other.start === this.start
    );
  }
  serialize(cycleMap: Map<View, any> = new Map()) {
    if (!cycleMap.has(this)) {
      if (this.target.length === this.start) {
        cycleMap.set(this, []);
      } else if (this.target[this.start] instanceof RestArg) {
        cycleMap.set(this, this.rest().serialize(cycleMap));
      } else {
        const value = [];
        cycleMap.set(this, value);
        value.push(
          this.first().serialize(cycleMap),
          ...this.rest().serialize(cycleMap)
        );
      }
    }
    return cycleMap.get(this);
  }
  copyTo(context: MatchSet) {
    if (this.empty() && this.more()) {
      return this.rest().copyTo(context);
    } else if (!this.empty()) {
      this.first().copyTo(context);
      this.rest().copyTo(context);
      return ViewFactory.array(context, this.target, this.start);
    } else {
      return ViewFactory.array(context, this.target, this.start);
    }
  }
  *unify(other: View) {
    if (other.isArg()) {
      yield* other.unify(this);
    } else if (this.isSame(other)) {
      yield true;
    } else if (other.isArray()) {
      if (!this.empty() && !other.empty()) {
        for (const _ of this.first().unify(other.first())) {
          yield* this.rest().unify(other.rest());
        }
      } else if (this.empty() && this.more()) {
        yield* this.rest().unify(other);
      } else if (other.empty() && other.more()) {
        yield* this.unify(other.rest());
      } else if (this.empty() && other.empty()) {
        yield true;
      }
    }
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
    return ViewFactory.view(this.context, this.target[this.start] as Expr);
  }
  rest<R = T extends Expr[] ? ArrayView<T> : never>(): R;
  rest(): View;
  rest() {
    return ViewFactory.array(this.context, this.target, this.start + 1);
  }
}

export class IndexArrayView<
  T extends ArrayExpr = ArrayExpr
> extends ArrayView<T> {
  *unify(other: View) {
    if (other.isArg()) {
      yield* other.unify(this);
    } else if (this.isSame(other)) {
      yield true;
    } else if (other.isArray()) {
      if (!other.empty()) {
        for (const _ of this.first().unify(other.first())) {
          yield* this.rest().unify(other.rest());
        }
      } else if (other.empty() && other.more()) {
        yield* this.unify(other.rest());
      }
    }
  }
  empty() {
    return false;
  }
  more() {
    return true;
  }
}

export class EmptyArrayView<
  T extends ArrayExpr = ArrayExpr
> extends ArrayView<T> {
  serialize() {
    return [];
  }
  *unify(other: View) {
    if (other.isArg()) {
      yield* other.unify(this);
    } else if (this.isSame(other)) {
      yield true;
    } else if (other.isArray()) {
      if (other.empty() && other.more()) {
        yield* this.unify(other.rest());
      } else if (other.empty()) {
        yield true;
      }
    }
  }
  empty() {
    return true;
  }
  more() {
    return false;
  }
  rest() {
    return this;
  }
}

export class ObjectView<V extends ObjectExpr = ObjectExpr> extends View {
  constructor(
    public context: MatchSet,
    public target: V,
    public keys = ViewFactory.array(context, Object.keys(target).sort(), 0)
  ) {
    super();
  }
  isObject(): this is ObjectView<V> {
    return true;
  }
  isSame(other: View) {
    return (
      other.isObject() &&
      other.context === this.context &&
      other.target === this.target
    );
  }
  serialize(cycleMap: Map<View, any> = new Map()) {
    if (!cycleMap.has(this)) {
      const value = {};
      cycleMap.set(this, value);
      Object.assign(value, {
        ...(this.empty()
          ? {}
          : { [this.firstKey()]: this.firstValue().serialize(cycleMap) }),
        ...(this.more() ? this.rest().serialize(cycleMap) : {}),
      });
    }
    return cycleMap.get(this);
  }
  copyTo(context: MatchSet) {
    if (this.empty()) {
      return new ObjectView(context, this.target, this.keys);
    }
    this.firstValue().copyTo(context);
    this.rest().copyTo(context);
    return new ObjectView(context, this.target, this.keys);
  }
  *unify(other: View) {
    if (other.isArg()) {
      yield* other.unify(this);
    } else if (this.isSame(other)) {
      yield true;
    } else if (other.isObject()) {
      if (!this.empty() && !other.empty()) {
        const thisKey = this.firstKey();
        const otherKey = other.firstKey();
        if (thisKey === otherKey) {
          for (const _ of this.firstValue().unify(other.firstValue())) {
            yield* this.rest().unify(other.rest());
          }
        }
      } else if (this.empty() && other.empty()) {
        yield true;
      }
    }
  }
  empty() {
    return this.keys.target.length === this.keys.start;
  }
  more() {
    return false;
  }
  firstKey(): string {
    return (this.keys.first() as ImmutableView<string>).value;
  }
  firstValue() {
    return ViewFactory.view(this.context, this.target[this.firstKey()]);
  }
  rest() {
    return new ObjectView(this.context, this.target, this.keys.rest());
  }
}

const EMPTY_ARRAY_VIEW = ViewFactory.array(null, [], 0);
const EMPTY_OBJECT_VIEW = new ObjectView(null, {}, EMPTY_ARRAY_VIEW);

export class ImmutableView<T extends Immutable = Immutable> extends View {
  constructor(public context: MatchSet, public value: T) {
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
  copyTo(context: MatchSet) {
    return new ImmutableView(context, this.value);
  }
  *unify(other: View) {
    if (other.isArg()) {
      yield* other.unify(this);
    } else if (this.isSame(other)) {
      yield true;
    }
  }
}

export function* _unify<S extends View, T extends View>(left: S, right: T) {
  yield* left.unify(right);
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

const [params, left, right, more] = args();
const [left2, right2] = args();
const [
  constructArg,
  goalArg,
  itemArg,
  numberArg,
  objectArg,
  keyArg,
  keyArg2,
  valueArg,
  newObjectArg,
  entriesArg,
  stringArg,
  booleanArg,
  nullArg,
  arrayArg,
  arrayArg2,
  templateArg,
  bagArg,
] = args();
const llOps: [
  [string, ...ArrayExpr],
  (statement: ArrayView, facts: Facts) => Generator<boolean>
][] = [
  [
    [",", left, right, ...more],
    function* _comma(statement, facts) {
      const scope = statement.context;
      for (const _ of _call(scope.get(left) as ArrayView, facts)) {
        const moreValue = scope.get(more);
        if (moreValue.isArray() && !moreValue.empty()) {
          yield* _call(
            ViewFactory.array(scope, [",", right, ...more], 0) as ArrayView,
            facts
          );
        } else {
          yield* _call(scope.get(right) as ArrayView, facts);
        }
      }
    },
  ],
  [
    [";", left, right],
    function* _comma(statement, facts) {
      const scope = statement.context;
      yield* _call(scope.get(left) as ArrayView, facts);
      yield* _call(scope.get(right) as ArrayView, facts);
    },
  ],
  [
    ["=", left, right],
    function* _assign(statement, facts) {
      const scope = statement.context;
      yield* _unify(scope.get(left), scope.get(right));
    },
  ],
  [
    ["assert", left],
    function* _assert(statement, facts) {
      facts.add(serialize(statement.context.get(left)));
      yield true;
    },
  ],
  [
    ["reject", left],
    function* _f(statement, facts) {
      const context = new MatchMap();
      let index = 0;
      for (const entry of facts.facts) {
        for (const _ of _unify(
          ViewFactory.array(context, entry as any, 0),
          statement.context.get(left)
        )) {
          facts.facts.splice(index, 1);
          yield true;
          return;
        }
        index++;
      }
    },
  ],
  [
    ["is", left, right],
    function* _settle(statement, facts) {
      const scope = statement.context;
      let leftFormula = scope.get(left);
      if (leftFormula.isArg()) {
        leftFormula = leftFormula.get();
      }
      let rightFormula = scope.get(right);
      if (rightFormula.isArg()) {
        rightFormula = rightFormula.get();
      }
      const leftValue = leftFormula.isArray()
        ? new ImmutableView(leftFormula.context, calc(serialize(leftFormula)))
        : leftFormula;
      const rightValue = rightFormula.isArray()
        ? new ImmutableView(rightFormula.context, calc(serialize(rightFormula)))
        : rightFormula;
      yield* _unify(leftValue, rightValue);
    },
  ],
  [
    ["<", left, right],
    function* _lt(statement, facts) {
      for (const _ of _call(
        ViewFactory.array(statement.context, ["is", left2, left], 0),
        facts
      )) {
        for (const _ of _call(
          ViewFactory.array(statement.context, ["is", right2, right], 0),
          facts
        )) {
          if (
            statement.context.get(left2).serialize() <
            statement.context.get(right2).serialize()
          ) {
            yield true;
          }
        }
      }
    },
  ],
  [
    [">", left, right],
    function* _lt(statement, facts) {
      for (const _ of _call(
        ViewFactory.array(statement.context, ["is", left2, left], 0),
        facts
      )) {
        for (const _ of _call(
          ViewFactory.array(statement.context, ["is", right2, right], 0),
          facts
        )) {
          if (
            statement.context.get(left2).serialize() >
            statement.context.get(right2).serialize()
          ) {
            yield true;
          }
        }
      }
    },
  ],
  [
    ["true", ...params],
    function* _true() {
      yield true;
    },
  ],
  [["false", ...params], function* _false() {}],
  [
    ["!", left],
    function* _not(statement, facts) {
      for (const _ of _call(statement.context.get(left) as ArrayView, facts)) {
        return;
      }
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
      console.log(...serialize(statement.context.get(params)));
      yield true;
    },
  ],
  [
    ["forAll", constructArg, goalArg],
    function* _forAll(statement, facts) {
      let passed = false;
      for (const _ of _call(
        statement.context.get(constructArg) as ArrayView,
        facts
      )) {
        passed = false;
        for (const _ of _call(
          statement.context.get(goalArg) as ArrayView,
          facts
        )) {
          passed = true;
          break;
        }
        if (!passed) {
          return;
        }
      }
      yield true;
    },
  ],
  [
    ["findall", templateArg, goalArg, bagArg],
    function* _findall(statement, facts) {
      const bag = [];
      for (const _ of _call(
        statement.context.get(goalArg) as ArrayView,
        facts
      )) {
        bag.push(statement.context.get(templateArg).serialize());
      }
      yield* _unify(
        statement.context.get(bagArg),
        ViewFactory.array(statement.context, bag, 0)
      );
    },
  ],
  [["is.number", numberArg], function* _numberIs(statement, facts) {}],
  [["is.bigint", numberArg], function* _bigintIs(statement, facts) {}],
  [["is.string", stringArg], function* _stringIs(statement, facts) {}],
  [["is.boolean", booleanArg], function* _booleanIs(statement, facts) {}],
  [["is.null", nullArg], function* _nullIs(statement, facts) {}],
  [["is.array", arrayArg], function* _arrayIs(statement, facts) {}],
  [["is.object", objectArg], function* _objectIs(statement, facts) {}],
  [
    ["array.get", arrayArg, keyArg, valueArg],
    function* _arrayGet(statement, facts) {
      const arrayView = statement.context.get(arrayArg);
      if (arrayView.isArray()) {
        let i = 0;
        let arrayViewIterator = arrayView;
        while (!arrayViewIterator.empty()) {
          for (const _ of _unify(
            ViewFactory.view(statement.context, i),
            statement.context.get(keyArg)
          )) {
            yield* _unify(
              arrayViewIterator.first(),
              statement.context.get(valueArg)
            );
          }

          i++;
          arrayViewIterator = arrayViewIterator.rest();
        }
        if (arrayViewIterator.more()) {
          for (const _ of _unify(
            statement.context.get(arrayArg2),
            arrayViewIterator
          )) {
            for (const _ of _call(
              ViewFactory.view(statement.context, [
                "array.get",
                arrayArg2,
                keyArg2,
                valueArg,
              ]),
              facts
            )) {
              const keyArg2View = statement.context.get(keyArg2);
              yield* _unify(
                statement.context.get(keyArg),
                ViewFactory.view(statement.context, keyArg2View.serialize() + i)
              );
            }
          }
        }
      }
    },
  ],
  [
    ["object.get", objectArg, keyArg, valueArg],
    function* _objectGet(statement, facts) {
      const objectView = statement.context.get(objectArg);
      if (objectView.isObject()) {
        let objectKeyView = objectView;
        while (!objectKeyView.empty()) {
          for (const _ of _unify(
            statement.context.get(keyArg),
            objectKeyView.keys.first()
          )) {
            yield* _unify(
              statement.context.get(valueArg),
              objectKeyView.firstValue()
            );
          }
          objectKeyView = objectKeyView.rest();
        }
      }
    },
  ],
  [
    ["object.set", objectArg, keyArg, valueArg, newObjectArg],
    function* _objectSet(statement, facts) {},
  ],
  [
    ["object.entries", objectArg, entriesArg],
    function* _objectEntries(statement, facts) {},
  ],
];

export function* _call(statement: ArrayView, facts: Facts) {
  const scope = new MatchMap();
  {
    for (const [llOp, llAction] of llOps) {
      const llOpView = ViewFactory.array(scope, llOp, 0);
      for (const _ of _unify(llOpView, statement)) {
        yield* llAction(llOpView, facts);
        return;
      }
    }

    try {
      for (const fact of facts.facts) {
        for (const _ of _unify(
          ViewFactory.array(scope, fact.statement, 0),
          statement
        )) {
          yield* _call(ViewFactory.array(scope, fact.condition, 0), facts);
        }
      }
    } catch (err) {
      if (err instanceof CutError) {
        return;
      }
      throw err;
    }
  }
}

export const call = _call;

function viewOf<T extends Expr | View>(match: MatchSet, target: T): ViewOf<T>;
function viewOf(match: MatchSet, target: Expr | View) {
  return ViewFactory.view(match, target);
}

{
  const [_0, _1, _2, _3, _4] = args();
  // const m = new MatchMap();
  // const n = new MatchMap();
  // for (const _ of _unify(viewOf(m, [1, _0]), viewOf(n, [_1, _1, ..._2]))) {
  //   console.log(
  //     serialize(viewOf(m, [_0, _1, _2])),
  //     serialize(viewOf(n, [_0, _1, _2]))
  //   );
  // }
  // for (const _ of _unify(viewOf(m, { a: _0 }), viewOf(n, { a: 1 }))) {
  //   console.log(
  //     serialize(viewOf(m, [_0, _1, _2])),
  //     serialize(viewOf(n, [_0, _1, _2]))
  //   );
  // }
  // // for (const _ of _unify(viewOf(m, { ..._0 }), viewOf(n, { a: 1 }))) {
  // //   console.log(
  // //     serialize(viewOf(m, [_0, _1, _2])),
  // //     serialize(viewOf(n, [_0, _1, _2]))
  // //   );
  // // }
  // // for (const _ of _unify(
  // //   viewOf(m, { a: 1, c: 3, ..._0 }),
  // //   viewOf(n, { b: 2, ..._1 })
  // // )) {
  // //   console.log(
  // //     serialize(viewOf(m, [_0, _1, _2])),
  // //     serialize(viewOf(n, [_0, _1, _2]))
  // //   );
  // // }
  // // for (const _ of _unify(
  // //   viewOf(m, [{ a: 1, c: 3, ..._0 }, _0]),
  // //   viewOf(n, [
  // //     { b: 2, ..._1 },
  // //     { d: 4, e: 5, ..._2 },
  // //   ])
  // // )) {
  // //   console.log(
  // //     serialize(viewOf(m, [_0, _1, _2])),
  // //     serialize(viewOf(n, [_0, _1, _2]))
  // //   );
  // // }
  // for (const _ of _call(
  //   viewOf(m, [",", ["value", _0, ..._1], ["log", _0, _1]]),
  //   new Facts().add(["value", 1]).add(["value", 2])
  // )) {
  // }
  // const start = process.hrtime.bigint
  //   ? process.hrtime.bigint()
  //   : process.hrtime();
  // // const startMs = Date.now();
  // for (const _ of _call(
  //   viewOf(m, [
  //     ",",
  //     [
  //       "get",
  //       [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  //       ..._0,
  //     ],
  //     ["true"],
  //   ]),
  //   new Facts().add(
  //     ["get", [_0, ..._1], _2, _3],
  //     [
  //       ";",
  //       [",", ["is", _2, 0], ["=", _3, _0]],
  //       [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
  //     ]
  //   )
  // )) {
  // }
  // console.log(
  //   ((process.hrtime.bigint
  //     ? process.hrtime.bigint()
  //     : process.hrtime()) as any) - (start as any)
  //   // Date.now() - startMs
  // );
  // for (const _ of new Facts()
  //   .add(
  //     ["get", [_0, ..._1], _2, _3],
  //     [
  //       ";",
  //       [",", ["is", _2, 0], ["=", _3, _0]],
  //       [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
  //     ]
  //   )
  //   .call([",", ["get", [1, 2, 3, 4], ..._0], ["log", _0]])) {
  // }
  // for (const _ of new Facts()
  //   .add(
  //     ["get", [_0, ..._1], _2, _3],
  //     [
  //       ";",
  //       [",", ["is", _2, 0], ["=", _3, _0]],
  //       [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
  //     ]
  //   )
  //   .call([",", ["get", [1, 2, 3, 4], _0, 2], ["log", _0]])) {
  // }
  // for (const _ of new Facts()
  //   .add(
  //     ["get", [_0, ..._1], _2, _3],
  //     [
  //       ";",
  //       [",", ["is", _2, 0], ["=", _3, _0]],
  //       [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
  //     ]
  //   )
  //   .call([",", ["get", [1, 2, 3, 4], 2, _0], ["log", _0]])) {
  // }
  const start2 = process.hrtime.bigint();
  const a = () => new Arg();
  const [houses, drinksWater, zebraOwner, _5, _6, _7, _8, _9] = args(
    "houses",
    "drinksWater",
    "zebraOwner"
  );
  for (const _ of new Facts()
    .add(["house", _0, [_0, _1, _2, _3, _4]])
    .add(["house", _0, [_1, _0, _2, _3, _4]])
    .add(["house", _0, [_1, _2, _0, _3, _4]])
    .add(["house", _0, [_1, _2, _3, _0, _4]])
    .add(["house", _0, [_1, _2, _3, _4, _0]])
    .add(["leftOf", _0, _1, [_0, _1, _2, _3, _4]])
    .add(["leftOf", _0, _1, [_2, _0, _1, _3, _4]])
    .add(["leftOf", _0, _1, [_2, _3, _0, _1, _4]])
    .add(["leftOf", _0, _1, [_2, _3, _4, _0, _1]])
    .add(["rightOf", _0, _1, [_1, _0, _2, _3, _4]])
    .add(["rightOf", _0, _1, [_2, _1, _0, _3, _4]])
    .add(["rightOf", _0, _1, [_2, _3, _1, _0, _4]])
    .add(["rightOf", _0, _1, [_2, _3, _4, _1, _0]])
    .add(["first", _0, [_0, _1, _2, _3, _4]])
    .add(["middle", _0, [_1, _2, _0, _3, _4]])
    .add(["nextTo", _0, _1, _2], ["leftOf", _0, _1, _2])
    .add(["nextTo", _0, _1, _2], ["rightOf", _0, _1, _2])
    .add(
      ["problem", houses],
      [
        ",",
        ["house", ["brit", a(), a(), "red", a()], houses],
        // ["log", houses],
        ["house", ["spaniard", "dog", a(), a(), a()], houses],
        // ["log", houses],
        ["house", [a(), a(), "coffee", "green", a()], houses],
        // ["log", houses],
        ["house", ["ukrainian", a(), "tea", a(), a()], houses],
        // ["log", houses],
        [
          "rightOf",
          [a(), a(), a(), "green", a()],
          [a(), a(), a(), "ivory", a()],
          houses,
        ],
        // ["log", houses],
        ["house", [a(), "snails", a(), a(), "oatmeal"], houses],
        // ["log", houses],
        ["house", [a(), a(), a(), "yellow", "chocolate chip"], houses],
        // ["log", houses],
        ["middle", [a(), a(), "milk", a(), a()], houses],
        ["first", ["norwegian", a(), a(), a(), a()], houses],
        [
          "nextTo",
          [a(), a(), a(), a(), "sugar"],
          [a(), "fox", a(), a(), a()],
          houses,
        ],
        [
          "nextTo",
          [a(), a(), a(), a(), "chocolate chip"],
          [a(), "horse", a(), a(), a()],
          houses,
        ],
        ["house", [a(), a(), "orange juice", a(), "peanut"], houses],
        ["house", ["japanese", a(), a(), a(), "frosted"], houses],
        [
          "nextTo",
          ["norwegian", a(), a(), a(), a()],
          [a(), a(), a(), "blue", a()],
          houses,
        ],
      ]
    )
    .call([
      ",",
      ["problem", houses],
      ["house", [zebraOwner, "zebra", a(), a(), a()], houses],
      ["house", [drinksWater, a(), "water", a(), a()], houses],
      ["log", zebraOwner, drinksWater],
    ])) {
    console.log(process.hrtime.bigint() - start2);
    console.log(_.serialize());
  }
}
