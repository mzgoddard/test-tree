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
  factsByCommand = {} as {
    [key: string]: { statement: Stmt; condition: Stmt }[];
  };
  constructor(public system: System) {}
  add(statement: Stmt, condition: Stmt = TRUE) {
    const fact = { statement, condition };
    this.facts.push(fact);
    if (!this.factsByCommand[statement[0]]) {
      this.factsByCommand[statement[0]] = [];
    }
    this.factsByCommand[statement[0]].push(fact);
    return this;
  }
  *call(statement: [string, ...ArrayExpr]) {
    const scope = new MatchMap();
    for (const _ of this.system._call(ViewFactory.array(scope, statement, 0))) {
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

export class Pool<T = any> {
  freeList: T[] = [];
  allocs: number = 0;
  free(item: T): asserts item is never {
    // if (this.freeList.includes(item)) {
    //   throw new Error("double free");
    // }
    this.freeList.push(item);
  }
  alloc(): T {
    // if (this.freeList.length) {
    //   this.allocs++;
    // }
    return this.freeList.pop();
  }
}

const matchPool = new Pool<MatchMap>();
const argViewPool = new Pool<ArgView>();
const arrayViewPool = new Pool<ArrayView>();
const indexArrayViewPool = new Pool<IndexArrayView>();
const emptyArrayViewPool = new Pool<EmptyArrayView>();
const objectViewPool = new Pool<ObjectView>();
const autoDropPool = new Pool<AutoDrop<any>>();

const DONE = { done: true } as IteratorResult<any>;
class AutoDrop<T extends { drop(): any }> implements IterableIterator<T> {
  step = 0;
  value = { value: undefined, done: false } as IteratorResult<T>;
  constructor(target: T, public pool?: Pool<AutoDrop<T>>) {
    this.value.value = target;
  }
  [Symbol.iterator]() {
    return this;
  }
  next() {
    if (this.step++ === 0) {
      return this.value;
    }
    if (this.step++ === 1) {
      this._drop();
    }
    return DONE;
  }
  throw(error: Error): IteratorResult<T> {
    this.drop();
    throw error;
  }
  return() {
    this.drop();
    return DONE;
  }
  drop(): asserts this is never {
    if (this.step === 0) {
      this.step++;
    }
    if (this.step++ === 1) {
      this._drop();
    }
  }
  private _drop() {
    this.value.value.drop();
    if (this.pool) {
      this.pool.free(this);
    }
  }

  static alloc<T extends { drop(): any }>(target: T, pool = autoDropPool) {
    return AutoDrop.init(pool.alloc(), target) || new AutoDrop(target, pool);
  }
  static init<T extends { drop(): any }>(autoDrop: AutoDrop<T>, target: T) {
    if (autoDrop) {
      autoDrop.step = 0;
      autoDrop.value.value = target;
    }
    return autoDrop;
  }
}

export class MatchMap implements MatchSet {
  map = new Map();
  constructor(public pool?: Pool<MatchMap>) {}
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
    if (value.pool !== undefined) {
      value.pool = undefined;
    }
    return this;
  }
  delete(arg: Arg) {
    this.map.delete(arg);
    return this;
  }
  drop(): asserts this is never {
    if (this.pool) {
      this.pool.free(this);
    }
  }
  *autoDrop() {
    try {
      yield this;
    } finally {
      this.drop();
    }
  }
  static alloc(pool = matchPool) {
    return MatchMap.init(pool.alloc()) || new MatchMap(pool);
  }
  static init(matchMap: MatchMap) {
    return matchMap;
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
  pool?: Pool;
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
  drop(): asserts this is never {
    if (this.pool !== undefined) {
      this.pool.free(this);
    }
  }
  *autoDrop() {
    try {
      yield this;
    } finally {
      this.drop();
    }
  }
}

export class ViewFactory {
  // static view<T extends Expr | View, R extends View = ViewOf<T>>(
  //   match: MatchSet,
  //   target: T
  // ): R;
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
    return ArgView.alloc(match, target);
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
      return EmptyArrayView.alloc(match, target, index);
    } else if (target[index] instanceof RestArg) {
      return ViewFactory.arg(match, (target[index] as RestArg).arg);
    }
    return IndexArrayView.alloc(match, target, index);
  }
}
export class ArgView extends View {
  constructor(
    public context: MatchSet,
    public target: Arg,
    public pool?: Pool<ArgView>
  ) {
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
        cycleMap.set(this, new Arg());
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
    if (this.isSame(other)) {
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
  static alloc(context: MatchSet, target: Arg, pool = argViewPool) {
    return (
      ArgView.init(pool.alloc(), context, target) ||
      new ArgView(context, target, pool)
    );
  }
  static init(view: ArgView, context: MatchSet, target: Arg) {
    if (view) {
      view.context = context;
      view.target = target;
    }
    return view;
  }
}

export class ArrayView<T extends ArrayExpr = ArrayExpr> extends View {
  constructor(
    public context: MatchSet,
    public target: T,
    public start: number,
    public pool?: Pool<ArrayView>
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
  static alloc<T extends ArrayExpr>(
    context: MatchSet,
    target: T,
    index: number,
    pool = arrayViewPool
  ) {
    return (
      ArrayView.init(pool.alloc(), context, target, index) ||
      new ArrayView(context, target, index, pool)
    );
  }
  static init<T extends ArrayExpr>(
    view: ArrayView<T>,
    context: MatchSet,
    target: T,
    index: number
  ) {
    if (view) {
      view.context = context;
      view.target = target;
      view.start = index;
    }
    return view;
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
        const thisFirst = this.first();
        const otherFirst = other.first();
        for (const _ of thisFirst.unify(otherFirst)) {
          const thisRest = this.rest();
          const otherRest = other.rest();
          yield* thisRest.unify(otherRest);
        }
      } else if (other.empty() && other.more()) {
        const otherRest = other.rest();
        yield* this.unify(otherRest);
      }
    }
  }
  empty() {
    return false;
  }
  more() {
    return true;
  }
  static alloc<T extends ArrayExpr>(
    context: MatchSet,
    target: T,
    start: number,
    pool = indexArrayViewPool
  ) {
    if (pool.freeList.length > 0) {
      return IndexArrayView.init(pool.alloc(), context, target, start);
    }
    return new IndexArrayView(context, target, start, pool);
  }
  static init<T extends ArrayExpr>(
    view: IndexArrayView<T>,
    context: MatchSet,
    target: T,
    start: number
  ) {
    if (view) {
      view.context = context;
      view.target = target;
      view.start = start;
    }
    return view;
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
  static alloc<T extends ArrayExpr>(
    context: MatchSet,
    target: T,
    start: number,
    pool = emptyArrayViewPool
  ) {
    return (
      EmptyArrayView.init(pool.alloc(), context, target, start) ||
      new EmptyArrayView(context, target, start, pool)
    );
  }
  static init<T extends ArrayExpr>(
    view: EmptyArrayView<T>,
    context: MatchSet,
    target: T,
    start: number
  ) {
    if (view) {
      view.context = context;
      view.target = target;
      view.start = start;
    }
    return view;
  }
}

export class ObjectView<V extends ObjectExpr = ObjectExpr> extends View {
  constructor(
    public context: MatchSet,
    public target: V,
    public entries = ViewFactory.array(
      context,
      Object.entries(target).sort(([aKey], [bKey]) =>
        aKey.localeCompare(bKey)
      ) as [string, Expr][],
      0
    )
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
        ...(!this.empty() || this.more()
          ? this.rest().serialize(cycleMap)
          : {}),
      });
    }
    return cycleMap.get(this);
  }
  copyTo(context: MatchSet) {
    if (this.empty()) {
      return new ObjectView(context, this.target, this.entries);
    }
    this.firstValue().copyTo(context);
    this.rest().copyTo(context);
    return new ObjectView(context, this.target, this.entries);
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
    return this.entries.target.length === this.entries.start;
  }
  more() {
    return false;
  }
  firstKey(): string {
    return (
      (this.entries.first() as ArrayView).first() as ImmutableView<string>
    ).value;
  }
  firstValue() {
    return (this.entries.first() as ArrayView<[string, Expr]>).rest().first();
  }
  rest() {
    return new ObjectView(this.context, this.target, this.entries.rest());
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
const commaMoreGoal = [",", ...more];
const llOps: [
  Stmt,
  (statement: ArrayView, system: System) => Generator<boolean>
][] = [
  [
    [",", left, ...more],
    function* _comma(statement, system) {
      const scope = statement.context;
      for (const _ of system._call(scope.get(left) as ArrayView)) {
        const moreGoalView = ViewFactory.array(
          scope,
          commaMoreGoal,
          0
        ) as ArrayView;
        yield* system._call(moreGoalView);
      }
    },
  ],
  [
    [","],
    function* _commaTrue(goal, system) {
      yield true;
    },
  ],
  [
    [";", left, ...more],
    function* _semicolon(statement, system) {
      const scope = statement.context;
      yield* system._call(scope.get(left) as ArrayView);
      yield* system._call(ViewFactory.array(scope, [";", ...more], 0));
    },
  ],
  [
    [";"],
    function* _semicolonTrue(goal, system) {
      yield true;
    },
  ],
  [
    ["=", left, right],
    function* _assign(statement, system) {
      const scope = statement.context;
      yield* scope.get(left).unify(scope.get(right));
    },
  ],
  [
    ["assert", left],
    function* _assert(statement, system) {
      system.facts.add(statement.context.get(left).serialize());
      yield true;
    },
  ],
  [
    ["reject", left],
    function* _reject(statement, system) {
      const context = new MatchMap();
      for (let i = 0; i < system.facts.facts.length; i++) {
        const entry = system.facts.facts[i];
        for (const _ of ViewFactory.array(context, entry as any, 0).unify(
          statement.context.get(left)
        )) {
          system.facts.facts.splice(i, 1);
          i--;
        }
      }
      yield true;
    },
  ],
  [
    ["is", left, right],
    function* _settle(statement, system) {
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
      yield* leftValue.unify(rightValue);
    },
  ],
  [
    ["<", left, right],
    function* _lt(statement, system) {
      for (const _ of system._call(
        ViewFactory.array(statement.context, ["is", left2, left], 0)
      )) {
        for (const _ of system._call(
          ViewFactory.array(statement.context, ["is", right2, right], 0)
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
    function* _lt(statement, system) {
      for (const _ of system._call(
        ViewFactory.array(statement.context, ["is", left2, left], 0)
      )) {
        for (const _ of system._call(
          ViewFactory.array(statement.context, ["is", right2, right], 0)
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
    ["true"],
    function* _true() {
      yield true;
    },
  ],
  [["false"], function* _false() {}],
  [
    ["!", left],
    function* _not(statement, system) {
      for (const _ of system._call(statement.context.get(left) as ArrayView)) {
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
    ["forall", constructArg, goalArg],
    function* _forAll(statement, system) {
      let passed = false;
      for (const _ of system._call(
        statement.context.get(constructArg) as ArrayView
      )) {
        passed = false;
        for (const _ of system._call(
          statement.context.get(goalArg) as ArrayView
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
    function* _findall(statement, system) {
      const bag = [];
      for (const _ of system._call(
        statement.context.get(goalArg) as ArrayView
      )) {
        bag.push(statement.context.get(templateArg).serialize());
      }
      yield* statement.context
        .get(bagArg)
        .unify(ViewFactory.array(statement.context, bag, 0));
    },
  ],
  [["is.number", numberArg], function* _numberIs(statement, system) {}],
  [["is.bigint", numberArg], function* _bigintIs(statement, system) {}],
  [["is.string", stringArg], function* _stringIs(statement, system) {}],
  [["is.boolean", booleanArg], function* _booleanIs(statement, system) {}],
  [["is.null", nullArg], function* _nullIs(statement, system) {}],
  [["is.array", arrayArg], function* _arrayIs(statement, system) {}],
  [["is.object", objectArg], function* _objectIs(statement, system) {}],
  [
    ["array.get", arrayArg, keyArg, valueArg],
    function* _arrayGet(statement, system) {
      const arrayView = statement.context.get(arrayArg);
      if (arrayView.isArray()) {
        let i = 0;
        let arrayViewIterator = arrayView;
        while (!arrayViewIterator.empty()) {
          for (const _ of ViewFactory.view(statement.context, i).unify(
            statement.context.get(keyArg)
          )) {
            yield* arrayViewIterator
              .first()
              .unify(statement.context.get(valueArg));
          }

          i++;
          arrayViewIterator = arrayViewIterator.rest();
        }
        if (arrayViewIterator.more()) {
          for (const _ of statement.context
            .get(arrayArg2)
            .unify(arrayViewIterator)) {
            for (const _ of system._call(
              ViewFactory.view(statement.context, [
                "array.get",
                arrayArg2,
                keyArg2,
                valueArg,
              ]) as ArrayView
            )) {
              const keyArg2View = statement.context.get(keyArg2);
              yield* statement.context
                .get(keyArg)
                .unify(
                  ViewFactory.view(
                    statement.context,
                    keyArg2View.serialize() + i
                  )
                );
            }
          }
        }
      }
    },
  ],
  [
    ["object.get", objectArg, keyArg, valueArg],
    function* _objectGet(statement, system) {
      const objectView = statement.context.get(objectArg);
      if (objectView.isObject()) {
        let objectKeyView = objectView;
        while (!objectKeyView.empty()) {
          for (const _ of statement.context
            .get(keyArg)
            .unify(objectKeyView.entries.first())) {
            yield* statement.context
              .get(valueArg)
              .unify(objectKeyView.firstValue());
          }
          objectKeyView = objectKeyView.rest();
        }
      }
    },
  ],
  [
    ["object.set", objectArg, keyArg, valueArg, newObjectArg],
    function* _objectSet(statement, system) {},
  ],
  [
    ["call", goalArg],
    function* _callOp(goal, system) {
      yield* system._call(goal.context.get(goalArg) as ArrayView);
    },
  ],
  [
    ["entries", objectArg, entriesArg],
    function* _objectEntries(goal, system) {
      const objectView = goal.context.get(objectArg);
      const entriesView = goal.context.get(entriesArg);
      if (objectView.isArg()) {
        if (entriesView.isArray()) {
          yield* objectView.unify(
            new ObjectView(
              entriesView.context,
              {},
              entriesView as ArrayView<[string, Expr][]>
            )
          );
          return;
        }
        throw new Error();
      } else if (objectView.isObject()) {
        yield* entriesView.unify(objectView.entries);
        return;
      }
      throw new Error();
    },
  ],
];

type Operation = [
  [string, ...ArrayExpr],
  (goal: ArrayView<Stmt>, system: System) => Generator<boolean>
];

interface UnifyOps {
  [Symbol.iterator](): Iterator<Operation>;
}

const [command] = args();
const getCommandGoal = [command, ...more];

const commandContext = new MatchMap();
function _getCommandName(goal: ArrayView) {
  if (!goal.empty()) {
    const commandNameView = goal.first();
    if (commandNameView.isImmutable()) {
      return commandNameView.serialize();
    }
  }
  for (const _ of ViewFactory.array(commandContext, getCommandGoal, 0).unify(
    goal
  )) {
    return commandContext.get(command).serialize();
  }
}

class SystemOps implements UnifyOps {
  ops = [] as Operation[];
  opsByCommand = {} as { [key: string]: Operation[] };
  constructor(public system?: System, initialOps: Operation[] = llOps) {
    for (const op of initialOps) {
      this.add(...op);
    }
  }
  add(...operation: Operation) {
    const [goal] = operation;
    const [command] = goal;
    this.ops.push(operation);
    if (!this.opsByCommand[command]) {
      this.opsByCommand[command] = [];
    }
    this.opsByCommand[command].push(operation);
  }
  *_call(goal: ArrayView) {
    const commandName = _getCommandName(goal);
    const opsForCommand = this.opsByCommand[commandName];
    if (opsForCommand) {
      for (const scope of MatchMap.alloc().autoDrop()) {
        for (const [llOp, llAction] of opsForCommand) {
          const llOpView = ViewFactory.array(scope, llOp, 0);
          for (const _ of llOpView.unify(goal)) {
            yield* llAction(llOpView, this.system);
            return;
          }
        }
      }
    }
  }
  *[Symbol.iterator]() {
    yield* this.ops;
  }
}

export class System {
  ops: SystemOps = new SystemOps(this);
  facts: Facts = new Facts(this);
  *call(goal: Stmt) {
    const context = new MatchMap();
    for (const _ of this._call(ViewFactory.array(context, goal, 0))) {
      yield context;
    }
  }
  *_call(goal: ArrayView) {
    let isOp = false;
    for (const _ of this.ops._call(goal)) {
      isOp = true;
      yield true;
    }
    if (isOp) {
      return;
    }

    for (const scope of MatchMap.alloc().autoDrop()) {
      try {
        const factName = _getCommandName(goal);
        const factsForCommand = this.facts.factsByCommand[factName];
        if (factsForCommand) {
          for (const fact of factsForCommand) {
            const factGoal = ViewFactory.array(scope, fact.statement, 0);
            for (const _ of factGoal.unify(goal)) {
              const factCondition = ViewFactory.array(scope, fact.condition, 0);
              yield* this._call(factCondition);
            }
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
}

const defaultSystem = new System();
export const _call = defaultSystem._call.bind(defaultSystem);
export const call = _call;

const viewOf = ViewFactory.view;

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
  for (const _ of new System().facts
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
    break;
  }
  console.log(
    autoDropPool.allocs,
    autoDropPool.freeList.length,
    matchPool.allocs,
    matchPool.freeList.length,
    argViewPool.allocs,
    argViewPool.freeList.length,
    arrayViewPool.allocs,
    arrayViewPool.freeList.length,
    indexArrayViewPool.allocs,
    indexArrayViewPool.freeList.length,
    emptyArrayViewPool.allocs,
    emptyArrayViewPool.freeList.length
  );
}
