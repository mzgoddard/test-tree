// import { ArraySlice, ObjectSlice, StringSlice } from "./Slice";

function combine(fn: (methods: any) => any, ...fns: ((methods: any) => any)[]) {
  return fns.reduce((carry, fn) => fn(carry), fn({}));
}

function parsed(_, value, next) {
  return {
    parsed: true,
    value,
    next,
  };
}
function value({ next }, value) {
  return parsed(null, value, next);
}
function next({ value }, next) {
  return parsed(null, value, next);
}
interface Goal {
  op: string;
}
interface Memory<T = any> {
  get(): T | undefined;
  push(value: T): Memory<T>;
  pop(): Memory<T>;
}
class NullMemory<T> implements Memory<T> {
  get() {
    return undefined;
  }
  push(value: any) {
    return new MemoryNode(value, this);
  }
  pop() {
    return this;
  }
}
const NULL_MEMORY = new NullMemory();
class MemoryNode<T> implements Memory<T> {
  constructor(public value: T, public next: Memory<T>) {}
  get() {
    return this.value;
  }
  push(value: T) {
    return new MemoryNode(value, this);
  }
  pop() {
    return this.next;
  }
}
class MemoryStack<T> {
  top: Memory<T> = NULL_MEMORY;
  peek(): T {
    return this.top.get();
  }
  push(value: T) {
    this.top = this.top.push(value);
  }
  poolPush(value: T, pool: MemoryPool) {
    this.top = pool.new(value, this.top);
  }
  pop(): T {
    const value = this.top.get();
    this.top = this.top.pop();
    return value;
  }
  poolPop(pool: MemoryPool) {
    const value = this.top.get();
    this.top = pool.delete(this.top);
    return value;
  }
}
class MemoryPool<T = any> {
  free = NULL_MEMORY;
  size = 0;
  new(value: T, next: Memory<T>) {
    if (this.free === NULL_MEMORY) {
      return new MemoryNode(value, next);
    }
    const top = this.free as MemoryNode<T>;
    this.free = top.next;
    top.value = value;
    top.next = next;
    this.size -= 1;
    return top;
  }
  delete(top: Memory<T>): Memory<T> {
    if (top === NULL_MEMORY) {
      return top;
    }
    const freed = top as MemoryNode<T>;
    const next = freed.next;
    if (this.size < 256) {
      freed.value = null;
      freed.next = this.free;
      this.free = freed;
      this.size += 1;
    }
    return next;
  }
}
class StackItemPool {
  free = new MemoryStack<StackItem>();
  pool = new MemoryPool();
  new(goal, onResolve, onReject): StackItem {
    if (this.free.top === NULL_MEMORY) {
      return { goal, memory: NULL_MEMORY, onResolve, onReject };
    }
    const value = this.free.poolPop(this.pool);
    value.goal = goal;
    value.memory = NULL_MEMORY;
    value.onResolve = onResolve;
    value.onReject = onReject;
    return value;
  }
  delete(item: StackItem) {
    // item.goal = null;
    // item.memory = NULL_MEMORY;
    // item.onResolve = noop;
    // item.onReject = noop;
    this.free.poolPush(item, this.pool);
  }
}
interface GramThreadHandle {
  (gramThread: GramThread): void;
}
function noop() {}
interface StackItem {
  goal: Goal;
  memory: Memory;
  onResolve: GramThreadHandle;
  onReject: GramThreadHandle;
}
enum GramThreadStage {
  Failure = 0,
  Passing = 1,
  NewGoal = 2,
}
class GramThread {
  stack: MemoryStack<StackItem> = new MemoryStack();
  stackPool = new StackItemPool();
  memoryPool = new MemoryPool();
  step = this.stepResolve;
  value = undefined;
  next = undefined;
  context: StackItem;

  constructor(public engine: Engine) {}

  valueSet(value: any): void {
    this.value = value;
  }
  valueGet(): any {
    return this.value;
  }
  nextSet(next: any): void {
    this.next = next;
  }
  nextGet(): Slice {
    return this.next;
  }
  goalGet(): any {
    return this.stack.peek().goal;
  }
  memoryPeek(): any {
    this.context.memory.get();
  }
  memoryPush(value: any): void {
    this.context.memory = this.memoryPool.new(value, this.context.memory);
  }
  memoryPop(): any {
    const value = this.context.memory.get();
    this.context.memory = this.memoryPool.delete(this.context.memory);
    return value;
  }
  reject(): void {
    this.step = this.stepReject;
  }
  do(goal): void {
    this.then(goal, noop, noop);
  }
  then(goal, onResolve, onReject): void {
    this.step = this.stepGoal;
    this.stack.poolPush(
      (this.context = this.stackPool.new(goal, onResolve, onReject)),
      // (this.context = { goal, memory: NULL_MEMORY, onResolve, onReject })
      this.memoryPool
    );
    // this.stack.push(
    //   (this.context = { goal, memory: NULL_MEMORY, onResolve, onReject })
    // );
  }
  catch(goal, onReject): void {
    this.then(goal, noop, onReject);
  }
  always(goal, onResult): void {
    this.then(goal, onResult, onResult);
  }

  stepGoal() {
    this.step = this.stepResolve;
    const item = (this.context = (
      this.stack.top as MemoryNode<StackItem>
    ).value);
    this.engine.methods[item.goal.op](this);
  }
  stepResolve() {
    const item = (this.context = this.stack.poolPop(this.memoryPool));
    item.onResolve(this);
    this.stackPool.delete(item);
  }
  stepReject() {
    const item = (this.context = this.stack.poolPop(this.memoryPool));
    item.onReject(this);
    this.stackPool.delete(item);
  }

  run(goal, value = this.value, next = this.next) {
    this.valueSet(value);
    this.nextSet(next);
    this.do(goal);
    while (this.stack.top !== NULL_MEMORY) {
      this.step();
    }
    return this.value;
  }
}

function coreMethods({}): { [key: string]: (gramThread: GramThread) => void } {
  return {
    set(gramThread) {
      gramThread.valueSet(gramThread.goalGet().value);
    },
    noop() {},
    _checkAfter(gramThread) {
      gramThread.nextSet(gramThread.memoryPop());
      gramThread.valueSet(gramThread.memoryPop());
    },
    check(gramThread) {
      gramThread.always(gramThread.goalGet().goal, this._checkAfter);
      gramThread.memoryPush(gramThread.valueGet());
      gramThread.memoryPush(gramThread.nextGet());
    },
    _mutateAfter(gramThread) {
      gramThread.nextSet(gramThread.memoryPop());
    },
    mutate(gramThread) {
      gramThread.always(gramThread.goalGet().goal, this._mutateAfter);
      gramThread.memoryPush(gramThread.nextGet());
    },
    _incrementAfter(gramThread) {
      gramThread.valueSet(gramThread.memoryPop());
    },
    increment(gramThread) {
      gramThread.always(gramThread.goalGet().goal, this._incrementAfter);
      gramThread.memoryPush(gramThread.valueGet());
    },
    parse(gramThread) {
      gramThread.do(gramThread.goalGet().goal);
    },
    _thenAfterFirst(gramThread) {
      gramThread.do(gramThread.goalGet().second);
    },
    then(gramThread) {
      gramThread.then(gramThread.goalGet().first, this._thenAfterFirst, noop);
    },
    _elseCatchFirst(gramThread) {
      gramThread.nextSet(gramThread.memoryPop());
      gramThread.valueSet(gramThread.memoryPop());
      gramThread.do(gramThread.goalGet().second);
    },
    else(gramThread) {
      gramThread.catch(gramThread.goalGet().first, this._elseCatchFirst);
      gramThread.memoryPush(gramThread.valueGet());
      gramThread.memoryPush(gramThread.nextGet());
    },
    _tisdAfterSecond(gramThread) {
      const second = gramThread.valueGet();
      const first = gramThread.memoryPop();
      gramThread.valueSet({ first, second });
      gramThread.nextSet(gramThread.memoryPop());
    },
    _tisdAfterFirst(gramThread) {
      const firstValue = gramThread.valueGet();
      gramThread.valueSet(gramThread.memoryPop());
      gramThread.nextSet(gramThread.memoryPop());
      gramThread.then(gramThread.goalGet().second, this._tisdAfterSecond, noop);
      gramThread.memoryPush(gramThread.nextGet());
      gramThread.memoryPush(firstValue);
    },
    tisd(gramThread) {
      gramThread.then(gramThread.goalGet().first, this._tisdAfterFirst, noop);
      gramThread.memoryPush(gramThread.nextGet());
      gramThread.memoryPush(gramThread.valueGet());
    },
    test(gramThread) {
      if (!gramThread.valueGet()) {
        gramThread.reject();
      }
    },
  };
}
function operationMethods(methods) {
  return {
    ...methods,
    _eq(gramThread) {
      const { first, second } = gramThread.valueGet();
      gramThread.valueSet(first === second);
    },
    _ne(gramThread) {
      const { first, second } = gramThread.valueGet();
      gramThread.valueSet(first !== second);
    },
    _lte(gramThread) {
      const { first, second } = gramThread.valueGet();
      gramThread.valueSet(first <= second);
    },
    _gte(gramThread) {
      const { first, second } = gramThread.valueGet();
      gramThread.valueSet(first >= second);
    },
    code(gramThread) {
      gramThread.valueSet(gramThread.valueGet().charCodeAt(0));
    },
  };
}
function typeMethods(methods): { [key: string]: GramThreadHandle } {
  return {
    ...methods,
    _array(gramThread) {
      gramThread.valueSet(Array.isArray(gramThread.valueGet()));
    },
    _object(gramThread) {
      const value = gramThread.valueGet();
      gramThread.valueSet(typeof value === "object" && value !== null);
    },
    _string(gramThread) {
      gramThread.valueSet(typeof gramThread.valueGet() === "string");
    },
    _typeof(gramThread) {
      gramThread.valueSet(typeof gramThread.valueGet());
    },
  };
}
function sliceMethods(methods): { [key: string]: GramThreadHandle } {
  return {
    ...methods,
    _has(gramThread) {
      gramThread.valueSet(gramThread.nextGet().has(gramThread.valueGet()));
    },
    _get(gramThread) {
      const property = gramThread.valueGet();
      gramThread.valueSet(gramThread.nextGet().get(property));
      gramThread.nextSet(gramThread.nextGet().increment(property));
    },

    _arraySlice(gramThread) {
      gramThread.nextSet(new ArraySlice(gramThread.valueGet()));
    },
    _objectSlice(gramThread) {
      gramThread.nextSet(new ObjectSlice(gramThread.valueGet()));
    },
    _stringSlice(gramThread) {
      gramThread.nextSet(new StringSlice(gramThread.valueGet()));
    },
  };
}
function valueMethods(methods): { [key: string]: GramThreadHandle } {
  return {
    ...methods,
    _consAfter(gramThread) {
      let value = gramThread.valueGet();
      if (value === undefined || value === null) {
        value = new NullCons();
      } else if (!(value instanceof Cons)) {
        value = new Cons(value);
      }
      gramThread.valueSet(new Cons(gramThread.memoryPop(), value));
    },
    cons(gramThread) {
      gramThread.then(gramThread.goalGet().goal, this._consAfter, noop);
      gramThread.memoryPush(gramThread.valueGet());
    },
    _nameAfter(gramThread) {
      gramThread.nextSet(gramThread.memoryPop());
      const key = gramThread.valueGet();
      const value = gramThread.memoryPop();
      gramThread.valueSet(new KV(key, value));
    },
    name(gramThread) {
      gramThread.then(gramThread.goalGet().key, this._nameAfter, noop);
      gramThread.memoryPush(gramThread.valueGet());
      gramThread.memoryPush(gramThread.nextGet());
    },
    asString(gramThread) {
      gramThread.valueSet(gramThread.valueGet().toString());
    },
    asArray(gramThread) {
      gramThread.valueSet(Array.from(gramThread.valueGet()));
    },
    asObject(gramThread) {
      const o = {};
      for (const kv of gramThread.valueGet()) {
        if (kv instanceof KV) {
          o[kv.key] = kv.value;
        }
      }
      gramThread.valueSet(o);
    },
  };
}
class Engine {
  constructor(public methods) {
    for (const key of Object.keys(methods)) {
      methods[key] = methods[key].bind(methods);
    }
  }
  _parse(env, goal, input) {
    if (input.parsed === false) {
      return input;
    }
    return this.methods[goal.op](goal, input, env);
  }
  parse(goal, value) {
    const env = {
      parse: null,
    };
    env.parse = this._parse.bind(this, env);
    return env.parse(goal, { parsed: true, value, next: value });
  }
}
function castBinaryArgs(op) {
  return function (first, second?) {
    if (second === undefined) {
      if (typeof first === "string") {
        if (first.length > 1) {
          second = g.set(first);
          first = g.noop();
        } else {
          second = g.set(first.charCodeAt(0));
          first = g.code();
        }
      } else {
        second = first;
        first = g.noop();
      }
    }
    if (typeof first !== "object") {
      first = g.set(first);
    }
    if (typeof second !== "object") {
      second = g.set(second);
    }
    return op(first, second);
  };
}
const g = {
  // core
  true() {
    return g.set(true);
  },
  false() {
    return g.set(false);
  },
  set(value) {
    return { op: "set", value };
  },
  noop() {
    return { op: "noop" };
  },
  check(goal) {
    return { op: "check", goal };
  },
  mutate(goal) {
    return { op: "mutate", goal };
  },
  increment(goal) {
    return { op: "increment", goal };
  },
  parse(goal) {
    return { op: "parse", goal };
  },
  grammar(goals: { [key: string]: any }): { [key: string]: Goal } {
    const _goals = {};
    for (const key of Object.keys(goals)) {
      _goals[key] = g.parse(null);
    }
    for (const key of Object.keys(goals)) {
      const goal =
        typeof goals[key] === "function" ? goals[key](_goals) : goals[key];
      _goals[key] = _goals[key].goal = goal;
    }
    return _goals;
  },
  then(first, second, ...more) {
    // return more.reduceRight((second, first) => ({op: 'then', first, second}), {op: 'then', first, second})
    if (more.length === 0) {
      return { op: "then", first, second };
    }
    return g.then(first, g.then(second, ...(more as [any, ...any[]])));
  },
  else(first, second) {
    return { op: "else", first, second };
  },
  tisd(first, second) {
    return { op: "tisd", first, second };
  },
  _test() {
    return { op: "test" };
  },
  some(first, ...goals) {
    if (goals.length === 0) return first;
    return g.else(first, g.some(...(goals as [any, ...any[]])));
  },

  // operations
  _binary(goal, first, second) {
    return g.then(g.tisd(first, second), goal);
  },
  _eq() {
    return { op: "_eq" };
  },
  eq: castBinaryArgs((first, second) => {
    return g._binary(g._eq(), first, second);
  }),
  _ne() {
    return { op: "_ne" };
  },
  ne: castBinaryArgs((first, second) => {
    return g._binary(g._ne(), first, second);
  }),
  _lte() {
    return { op: "_lte" };
  },
  lte: castBinaryArgs((first, second) => {
    return g._binary(g._lte(), first, second);
  }),
  _gte() {
    return { op: "_gte" };
  },
  gte: castBinaryArgs((first, second) => {
    return g._binary(g._gte(), first, second);
  }),
  _array() {
    return { op: "_array" };
  },
  _object() {
    return { op: "_object" };
  },
  _string() {
    return { op: "_string" };
  },
  code() {
    return { op: "code" };
  },
  char(a, z?) {
    if (z === undefined) {
      return g.then(g.first(), g.isEq(a));
    }
    if (a > z) {
      return g.then(g.first(), g.else(g.isGte(a), g.isLte(z)));
    }
    return g.then(g.first(), g.isGte(a), g.isLte(z));
  },
  expr(p0, ...phrase) {
    if (phrase.length > 0) {
      return g.then(p0, g.cons(g.expr(...(phrase as [any, ...any[]]))));
    }
    return p0;
  },
  loopExpr(p0, ...phrase) {
    if (phrase.length > 0) {
      return g.then(p0, g.cons(g.loopExpr(...(phrase as [any, ...any[]]))));
    }
    return g.some(p0, g.nullCons());
  },
  term(phrase: string) {
    return g.expr(...(phrase.split("").map(g.char) as [any, ...any[]]));
  },

  // control
  test(goal) {
    return g.check(g.then(goal, g._test()));
  },
  isEq(first, second?) {
    return g.test(g.eq(first, second));
  },
  isNe(first, second?) {
    return g.test(g.ne(first, second));
  },
  isLte(first, second?) {
    return g.test(g.lte(first, second));
  },
  isGte(first, second?) {
    return g.test(g.gte(first, second));
  },

  // slice
  _has() {
    return { op: "_has" };
  },
  _get() {
    return { op: "_get" };
  },
  get(property) {
    return g.then(g.set(property), g.test(g._has()), g._get());
  },
  first() {
    return g.get(0);
  },
  _end() {
    return { op: "_end" };
  },
  end() {
    return g.then(g._end(), g._test(), g.nullCons());
  },
  _arraySlice() {
    return { op: "_arraySlice" };
  },
  _objectSlice() {
    return { op: "_objectSlice" };
  },
  _stringSlice() {
    return { op: "_stringSlice" };
  },
  array() {
    return g.then(g.test(g._array()), g._arraySlice());
  },
  object() {
    return g.then(g.test(g._object()), g._objectSlice());
  },
  string() {
    return g.then(g.test(g._string()), g._stringSlice());
  },

  // value
  cons(goal) {
    return { op: "cons", goal };
  },
  nullCons() {
    return g.set(new NullCons());
  },
  name(key: string) {
    return { op: "name", key };
  },
  asArray() {
    return { op: "asArray" };
  },
  asObject() {
    return { op: "asObject" };
  },
  asString() {
    return { op: "asString" };
  },

  scope(boundFields, goal) {
    return { op: "scope", boundFields, goal };
  },
  store(field) {
    return { op: "store", field };
  },
  retrieve(field) {
    return { op: "retrieve", field };
  },
};
interface ConsNode {
  tail: ConsNode;
  toString(): string;
  [Symbol.iterator](): Iterator<any>;
}
class NullCons implements ConsNode {
  tail: ConsNode;
  constructor() {
    this.tail = this;
  }
  toString() {
    return "";
  }
  *[Symbol.iterator]() {}
}
class Cons implements ConsNode {
  constructor(
    public head: any = undefined,
    public tail: ConsNode = new NullCons()
  ) {}
  toString() {
    return this.head.toString() + this.tail.toString();
  }
  *[Symbol.iterator]() {
    if (this.head instanceof Cons || this.head instanceof NullCons) {
      yield* this.head;
    } else {
      yield this.head;
    }
    yield* this.tail;
  }
}
class KV {
  constructor(public key: string, public value: any) {}
}
abstract class Slice {
  abstract has(property: any): boolean;
  abstract get(property: any): any;
  abstract increment(property: any): Slice;
}
class ArraySlice extends Slice {
  constructor(
    public origin: any[],
    public start: number = 0,
    public end: number = origin.length
  ) {
    super();
  }
  has(property: number) {
    return property + this.start < this.end;
  }
  get(property: number) {
    return this.origin[property + this.start];
  }
  increment(property: number = 0) {
    return new ArraySlice(this.origin, this.start + property + 1, this.end);
  }
}
class StringSlice extends Slice {
  constructor(
    public origin: string,
    public start: number = 0,
    public end: number = origin.length
  ) {
    super();
  }
  has(property: number) {
    return property + this.start < this.end;
  }
  get(property: number) {
    return this.origin[property + this.start];
  }
  increment(property: number = 0) {
    return new StringSlice(this.origin, this.start + property + 1, this.end);
  }
}
interface KeyNode {
  includes(property: string): boolean;
  add(property: string): KeyNode;
}
class NullKey implements KeyNode {
  includes(property: string): boolean {
    return false;
  }
  add(property: string): KeyNode {
    return new Key(property, this);
  }
}
class Key implements KeyNode {
  constructor(public key: string, public next: KeyNode = new NullKey()) {}
  includes(property: string): boolean {
    return this.key === property || this.next.includes(property);
  }
  add(property: string): KeyNode {
    return new Key(property, this);
  }
}
class ObjectSlice extends Slice {
  constructor(
    public origin: { [key: string]: any },
    public skip: KeyNode = new NullKey()
  ) {
    super();
  }
  has(property: string) {
    return property in this.origin && !this.skip.includes(property);
  }
  get(property: string) {
    return this.origin[property];
  }
  increment(property: string) {
    return new ObjectSlice(this.origin, this.skip.add(property));
  }
}

{
  const e = new Engine(
    combine(
      coreMethods,
      operationMethods,
      typeMethods,
      sliceMethods,
      valueMethods
    )
  );
  const csv = g.grammar({
    doubleQuote: g.char('"'),
    comma: g.char(","),
    cr: g.char("\r"),
    lf: g.char("\n"),
    crlf: (r) => g.expr(r.cr, r.lf),
    nl: (r) => g.some(r.crlf, r.cr, r.lf),
    newlines: (r) => g.loopExpr(r.nl, r.newlines),
    text: (r) => g.char("a", "z"),
    escapedQuote: (r) => g.expr(r.doubleQuote, r.doubleQuote),
    notQuote: () => g.then(g.first(), g.isNe('"')),
    quotedText: (r) => g.some(r.escapedQuote, r.notQuote),
    escapedChar: (r) => g.loopExpr(r.quotedText, r.escapedChar),
    escaped: (r) => g.expr(r.doubleQuote, r.escapedChar, r.doubleQuote),
    notEscaped: (r) => g.some(g.expr(r.text, r.notEscaped), g.nullCons()),
    cell: (r) => g.then(g.some(r.escaped, r.notEscaped), g.asString()),
    cells: (r) => g.loopExpr(r.cell, g.then(g.increment(r.comma), r.cells)),
    row: (r) => g.then(r.cells, g.asArray()),
    rows: (r) => g.loopExpr(r.row, g.then(g.increment(r.newlines), r.rows)),
    csv: (r) => g.then(g.string(), r.rows, g.asArray()),
  });
  const t = new GramThread(e);
  // const v = t.run(csv.row, null, new StringSlice("a,b,c\n"));
  const sp = typeof performance !== "undefined" ? performance.now() : 0,
    sd = Date.now();
  for (let i = 0; i < 1000; i++) {
    t.run(
      csv.csv,
      "a,b,c\nd,e,f\na,b,c\nd,e,f\na,b,c\nd,e,f\na,b,c\nd,e,f\na,b,c\nd,e,f"
    );
  }
  console.log(
    ((typeof performance !== "undefined" ? performance.now() : 0) - sp) / 1000,
    (Date.now() - sd) / 1000
  );
  const v = t.run(
    csv.csv,
    'a,b,c\nd,e,f\na,b,c\nd,e,f\na,bhi,c\nd,e,f\na,b,c\nd,e,f\n"a\nb,z",b,c\nd,e,f'
  );
  console.log(v, t.nextGet());
}

{
  const e = new Engine(
    combine(
      coreMethods,
      operationMethods,
      typeMethods,
      sliceMethods,
      valueMethods
    )
  );
  g.grammar({
    first: g.test(g.then(g.object(), g.get("op"), g.isEq("first"))),
    firstAElseFirstB: g.then(
      g.object(),
      g.get("op"),
      g.isEq("else"),
      g.get("first"),
      g.mutate(
        g.then(
          g.object(),
          g.get("op"),
          g.isEq("then"),
          g.get("first"),
          g.check(
            g.then(
              g.object(),
              g.get("op"),
              g.isEq("get"),
              g.get("property"),
              g.isEq(0),
              g.check(g.end())
            )
          ),
          g.store("first"),
          g.get("second"),
          g.store("a"),
          g.check(g.end())
        )
      ),
      g.get("second"),
      g.mutate(
        g.then(
          g.object(),
          g.get("op"),
          g.isEq("then"),
          g.get("first"),
          g.check(
            g.then(
              g.object(),
              g.get("op"),
              g.isEq("get"),
              g.get("property"),
              g.isEq(0)
            )
          ),
          g.get("second"),
          g.store("b"),
          g.check(g.end())
        )
      ),
      g.set("then"),
      g.name("op"),
      g.cons(
        g.then(
          g.retrieve("first"),
          g.name("first"),
          g.cons(
            g.then(
              g.set("else"),
              g.name("op"),
              g.cons(
                g.then(
                  g.retrieve("a"),
                  g.name("first"),
                  g.cons(g.then(g.retrieve("b"), g.name("second")))
                )
              ),
              g.asObject(),
              g.name("second")
            )
          )
        )
      )
    ),
  });
}
