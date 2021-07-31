import { Slice, StringSlice, ArraySlice, KeyList, ObjectSlice } from "./Slice";

type SliceGoal = TermGoal | CharRangeGoal | EOFGoal | FirstGoal | KeyGoal;
type FlowGoal = UnaryGoal | BinaryGoal;
type CollectionGoal = FrequencyGoal | SequenceGoal;
type StateGoal =
  | StateNestGoal
  | StateStoreGoal
  | StoreRetrieveGoal
  | StateReferenceGoal;
type TypeGoal =
  | AnyGoal
  | ArrayGoal
  | GreaterThanGoal
  | IntGoal
  | LessThanGoal
  | NumberGoal
  | ObjectGoal
  | RealGoal
  | StringGoal
  | ValueGoal;
/** Every goal. */
type Goal =
  | SliceGoal
  | FlowGoal
  | CollectionGoal
  | StateGoal
  | TypeGoal
  | MapGoal
  | ReferenceGoal;
interface AnyGoal {
  type: "any";
}
interface TermGoal<T extends string = string> {
  type: "term";
  term: T;
}
interface CharRangeGoal {
  type: "charRange";
  start: string;
  end: string;
}
interface SOFGoal {
  type: "startOfFile";
}
interface EOFGoal {
  type: "endOfFile";
}
interface FirstGoal {
  type: "first";
  goal: Goal;
}
interface FirstKeyGoal {
  type: "firstKey";
  goal: Goal;
}
interface NumberGoal {
  type: "number";
}
interface IntGoal {
  type: "int";
}
interface RealGoal {
  type: "real";
}
interface GreaterThanGoal {
  type: "greaterThan";
  greaterThan: number;
}
interface LessThanGoal {
  type: "lessThan";
  lessThan: number;
}
interface BooleanGoal {
  type: "boolean";
}
type Value = string | number | boolean | symbol | undefined;
interface ValueGoal<T extends Value = Value> {
  type: "value";
  value: T;
}
interface LookAheadGoal {
  type: "lookAhead";
  goal: Goal;
}
interface UnaryGoal {
  type: "unary";
  unaryType: "logicalNot";
  goal: Goal;
}
interface BinaryGoal {
  type: "binary";
  binaryType: "logicalOr" | "logicalAnd" | "logicalXor";
  goal1: Goal;
  goal2: Goal;
}
interface FrequencyGoal {
  type: "frequency";
  frequencyType: "atMostOne" | "atLeastZero" | "atLeastOne";
  goal: Goal;
}
interface SequenceGoal {
  type: "sequence";
  sequence: Goal[];
}
interface ReferenceGoal {
  type: "reference";
  goal: Goal;
}
interface StateNestGoal {
  type: "state";
  stateType: "nest";
  bindingMap: [string, string][];
  goal: Goal;
}
interface StateStoreGoal {
  type: "state";
  stateType: "store";
  goal: Goal;
  storeKey: string;
  isCollection: boolean;
}
interface StoreRetrieveGoal {
  type: "state";
  stateType: "retrieve";
  retrieveKey: string;
}
interface StateReferenceGoal {
  type: "state";
  stateType: "reference";
  referenceKey: string;
}
interface MapGoal {
  type: "map";
  goal: Goal;
  change: string;
  options: any;
}
interface StringGoal {
  type: "string";
  goal?: Goal;
}
interface ArrayGoal {
  type: "array";
  goal?: Goal;
}
interface KeyGoal {
  type: "key";
  key: string;
  goal?: Goal;
}
interface ObjectGoal {
  type: "object";
  goal?: Goal;
}
type ParseResult<T = any, S extends Slice | null = any> =
  | {
      parsed: true;
      result: T;
      remainder: S;
    }
  | {
      parsed: false;
      reason?: any;
    };
type GoalParser<G extends Goal = any, T extends any = any> = (
  goal: G,
  target: T,
  env
) => ParseResult;
function parseGoal(goal: Goal, target, env): ParseResult {
  return parsers[goal.type as string](goal, target, env);
}
function parseUnaryGoal(goal: UnaryGoal, target, env): ParseResult {
  return unaryParsers[goal.unaryType as string](goal, target, env);
}
function parseBinaryGoal(goal: BinaryGoal, target, env): ParseResult {
  return binaryParsers[goal.binaryType as string](goal, target, env);
}
function parseStateGoal(goal: StateGoal, target, env): ParseResult {
  return stateParsers[goal.stateType as string](goal, target, env);
}
const unaryParsers: {
  [key in UnaryGoal["unaryType"]]: GoalParser<UnaryGoal>;
} = {
  logicalNot({ goal }, target, env): ParseResult {
    if (parseGoal(goal, target, env).parsed === false) {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
};
const binaryParsers: {
  [key in BinaryGoal["binaryType"]]: GoalParser<BinaryGoal>;
} = {
  logicalAnd({ goal1, goal2 }, target, env): ParseResult {
    const result1 = parseGoal(goal1, target, env);
    if (!result1.parsed) return result1;
    const result2 = parseGoal(goal2, target, env);
    return result2;
  },
  logicalOr({ goal1, goal2 }, target, env): ParseResult {
    const result1 = parseGoal(goal1, target, env);
    if (result1.parsed) return result1;
    return parseGoal(goal2, target, env);
  },
  logicalXor({ goal1, goal2 }, target, env): ParseResult {
    const result1 = parseGoal(goal1, target, env);
    const result2 = parseGoal(goal2, target, env);
    if (result1.parsed !== result2.parsed) {
      if (result1.parsed) {
        return result1;
      }
      return result2;
    }
    return { parsed: false };
  },
};
const stateParsers: {
  [key in StateGoal["stateType"]]: GoalParser<StateGoal & { stateType: key }>;
} = {
  reference({ referenceKey }, target, env) {
    const goal = env.state[referenceKey];
    return parseGoal(goal, target, env);
  },
  nest({ bindingMap, goal }, target, env): ParseResult {
    const { state } = env;
    env.state = {};
    for (const [oldKey, newKey] of bindingMap) {
      Object.defineProperty(env.state, newKey, {
        get() {
          return state[oldKey];
        },
        set(value) {
          state[oldKey] = value;
        },
      });
    }
    const result = parseGoal(goal, target, env);
    env.state = state;
    return result;
  },
  retrieve({ retrieveKey }, target, env) {
    return { parsed: true, result: env.state[retrieveKey], remainder: null };
  },
  store({ goal, storeKey, isCollection }, target, env) {
    const result = parseGoal(goal, target, env);
    if (result.parsed) {
      if (isCollection) {
        env.state[storeKey] = env.state[storeKey] || [];
        env.state[storeKey].push(result.result);
      } else {
        env.state[storeKey] = result.result;
      }
    }
    return result;
  },
};
const parsers: { [key in Goal["type"]]: GoalParser<Goal & { type: key }> } = {
  any(goal, target, env): ParseResult {
    return { parsed: true, result: target, remainder: null };
  },
  array(goal, target, env): ParseResult {
    if (Array.isArray(target)) {
      if (!goal.goal) {
        return { parsed: true, result: target, remainder: null };
      }
      return parseGoal(goal.goal, new ArraySlice(target), env);
    }
    return { parsed: false };
  },
  binary(goal: BinaryGoal, target, env): ParseResult {
    return parseBinaryGoal(goal, target, env);
  },
  charRange(goal: CharRangeGoal, target: StringSlice, env): ParseResult {
    if (target.hasFirst()) {
      const char = target.first();
      const code = char.charCodeAt(0);
      if (code >= goal.start.charCodeAt(0) && code <= goal.end.charCodeAt(0)) {
        return { parsed: true, result: char, remainder: target.slice(1) };
      }
    }
    return { parsed: false };
  },
  endOfFile(goal, target: StringSlice, env) {
    if (!target.hasFirst()) {
      return { parsed: true, result: "", remainder: target };
    }
    return { parsed: false };
  },
  first(goal: FirstGoal, target: Slice, env): ParseResult {
    if (target.hasFirst()) {
      const result = parseGoal(goal.goal, target.first(), env);
      if (result.parsed) {
        return {
          parsed: true,
          result: result.result,
          remainder: target.tail(),
        };
      }
    }
    return { parsed: false };
  },
  frequency(goal: FrequencyGoal, target, env): ParseResult {
    if (goal.frequencyType === "atMostOne") {
      const { parsed, result, remainder } =
        parsers[(goal.goal.type, target, env)];
      if (parsed) {
        return { parsed: true, result: [result], remainder };
      }
      return { parsed: true, result: [], remainder: target };
    }
    let results = [];
    let result;
    let parseResult;
    let remainder = target;
    while (
      ((parseResult = parseGoal(goal.goal, remainder, env)), parseResult.parsed)
    ) {
      ({ result, remainder } = parseResult);
      results.push(result);
    }
    if (goal.frequencyType === "atLeastOne" && results.length === 0) {
      return { parsed: false };
    }
    return { parsed: true, result: results, remainder };
  },
  greaterThan(goal: GreaterThanGoal, target, env): ParseResult {
    if (goal.greaterThan >= target) {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  int(goal, target, env): ParseResult {
    if ((target | 0) === target) {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  key(goal: KeyGoal, target: ObjectSlice, env): ParseResult {
    if (target.has(goal.key)) {
      const result = parseGoal(goal.goal, target.get(goal.key), env);
      if (result.parsed) {
        return {
          parsed: true,
          result: {
            key: goal.key,
            value: result.result,
          },
          remainder: target.slice(KeyList.one(goal.key)),
        };
      }
    }
    return { parsed: false };
  },
  lessThan(goal: LessThanGoal, target, env): ParseResult {
    if (goal.lessThan <= target) {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  map(goal, target, env): ParseResult {
    const result = parseGoal(goal.goal, target, env);
    if (result.parsed) {
      const changed = env.parser.mapMethods[goal.change](
        result.result,
        goal.options,
        env
      );
      return { parsed: true, result: changed, remainder: result.remainder };
    }
    return { parsed: false };
  },
  number(goal, target, env): ParseResult {
    if (typeof target === "number") {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  object(goal: ObjectGoal, target, env): ParseResult {
    if (
      typeof target === "object" &&
      target !== null &&
      !Array.isArray(target)
    ) {
      if (!goal.goal) {
        return { parsed: true, result: target, remainder: null };
      }
      if ("cycles" in env) {
        if (!env.cycles.has(goal)) {
          env.cyles.set(goal, new Map());
        }
        if (env.cycles.get(goal).has(target)) {
          return env.cycles.get(goal).get(target).result;
        } else {
          env.cycles.get(goal).set(target, {
            result: { parsed: true, result: {}, remainder: null },
          });
        }
      }
      let result = parseGoal(goal.goal, new ObjectSlice(target), env);
      if (
        result.parsed &&
        Array.isArray(result.result) &&
        result.result.some(
          (pair) => typeof pair === "object" && pair !== null && "key" in pair
        )
      ) {
        result = {
          parsed: true,
          result: result.result.reduce(
            (carry, next) =>
              typeof next === "object" && next !== null && "key" in next
                ? { ...carry, [next.key]: next.value }
                : carry,
            {}
          ),
          remainder: null,
        };
        if ("cycles" in env) {
          Object.assign(
            env.cycles.get(goal).get(target).result.result,
            result.result
          );
        }
      }
      if ("cycles" in env) {
        env.cycles.get(goal).delete(target);
      }
      return result;
    }
    return { parsed: false };
  },
  real(goal, target, env): ParseResult {
    if (typeof target === "number") {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  reference(goal: ReferenceGoal, target, env): ParseResult {
    return parseGoal(goal.goal, target, env);
  },
  sequence(goal: SequenceGoal, target, env): ParseResult {
    const results = [];
    let result;
    let remainder = target;
    for (const subgoal of goal.sequence) {
      const parseResult = parseGoal(subgoal, remainder, env);
      if (parseResult.parsed) {
        ({ result, remainder } = parseResult);
        results.push(result);
      } else {
        return parseResult;
      }
    }
    return { parsed: true, result: results, remainder };
  },
  state(goal: StateGoal, target, env): ParseResult {
    return parseStateGoal(goal as any, target, env);
  },
  string(goal: StringGoal, target, env): ParseResult {
    if (typeof target === "string") {
      if (goal.goal) {
        return parseGoal(goal.goal, new StringSlice(target), env);
      }
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
  term(goal: TermGoal, target: StringSlice, env): ParseResult {
    if (target.startsWith(goal.term)) {
      return {
        parsed: true,
        result: goal.term,
        remainder: target.slice(goal.term.length),
      };
    }
    return { parsed: false };
  },
  unary(goal: UnaryGoal, target, env): ParseResult {
    throw new Error("");
  },
  value(goal: ValueGoal, target, env): ParseResult {
    if (target === goal.value) {
      return { parsed: true, result: target, remainder: null };
    }
    return { parsed: false };
  },
};
const commonMapMethods = {
  flat(ary) {
    return ary.reduce(
      (carry, next) =>
        next === undefined
          ? carry
          : Array.isArray(next)
          ? [...carry, ...next]
          : [...carry, next],
      []
    );
  },
  array(item) {
    return [item];
  },
  join(ary, options) {
    return ary.filter((value) => value !== undefined).join(options.joiner);
  },
  first(ary) {
    return ary[0];
  },
  token(value, options) {
    return { type: "token", tokenType: options.type, value };
  },
  skip() {
    return undefined;
  },
  filterUndefined(ary) {
    return ary.filter((value) => value !== undefined);
  },
};
interface ParserEnv {
  parser: Parser<any>;
  state: { [key: string]: any };
}
class Parser<
  G extends Goal,
  Methods extends {
    [key: string]: (input: any, options: any, env: ParserEnv) => any;
  } = {}
> {
  mapMethods: typeof commonMapMethods & Methods;
  constructor(public goal: G, mapMethods?: Methods) {
    this.mapMethods = { ...commonMapMethods, ...mapMethods };
  }
  get defaultEnv() {
    return { parser: this, state: {} };
  }
  parse(target: any, env = this.defaultEnv): ParseResult {
    return parsers[this.goal.type as string](
      this.goal,
      target,
      env
    ) as ParseResult;
  }

  static guess<G extends Guessable>(
    goal: G
  ): Parser<
    typeof pf["guess"] extends (goal: G) => infer Goal ? Goal : never,
    {}
  > {
    return new Parser(pf.guess(goal));
  }
}

function guess<T extends Chain<any>>(
  goal: T
): T extends Chain<infer G> ? G : never;
function guess<T extends Goal>(goal: T): T;
function guess<T extends { [key: string]: any }>(goal: T): ObjectGoal;
function guess<T extends any[]>(goal: T): ArrayGoal;
function guess<T extends number | string | boolean | null | undefined>(
  goal: T
): ValueGoal;
function guess(goal: any): Goal;
function guess(goal: any): Goal {
  if (goal instanceof Chain) {
    return goal.goal;
  }
  if (typeof goal === "object" && goal !== null) {
    if (Array.isArray(goal)) return pf.array(goal);
    if ("type" in goal && typeof goal.type === "string") return goal;
    return pf.object(goal);
  }
  return pf.value(goal);
}

type Guessable =
  | Goal
  | Chain
  | { [key: string]: Guessable }
  | Guessable[]
  | number
  | string
  | boolean
  | null
  | undefined;

const pf = {
  and(goal1: Guessable, goal2: Guessable): BinaryGoal {
    return {
      type: "binary",
      binaryType: "logicalAnd",
      goal1: pf.guess(goal1),
      goal2: pf.guess(goal2),
    };
  },
  any(): AnyGoal {
    return { type: "any" };
  },
  array(goal: Guessable[]): ArrayGoal {
    if (goal.length === 0) {
      throw new Error("");
    }
    if (goal.length === 1) {
      return {
        type: "array",
        goal: pf.frequency("atLeastZero", pf.first(goal[0])),
      };
    }
    return {
      type: "array",
      goal: pf.frequency("atLeastZero", pf.sequence(goal)),
    };
  },
  charRange(start: string, end: string): CharRangeGoal {
    return { type: "charRange", start, end };
  },
  eof(): EOFGoal {
    return { type: "endOfFile" };
  },
  every(goal0: Guessable, ...goals: Guessable[]): Goal {
    return goals.reduce(pf.and, pf.guess(goal0)) as Goal;
  },
  first(goal: Guessable): FirstGoal {
    return { type: "first", goal: pf.guess(goal) };
  },
  frequency: Object.assign(
    function (
      frequencyType: FrequencyGoal["frequencyType"],
      goal: Guessable
    ): FrequencyGoal {
      return { type: "frequency", frequencyType, goal: pf.guess(goal) };
    },
    {
      atLeastZero: (goal: Guessable) => pf.frequency("atLeastZero", goal),
      atLeastOne: (goal: Guessable) => pf.frequency("atLeastOne", goal),
      atMostOne: (goal: Guessable) => pf.frequency("atMostOne", goal),
    }
  ),
  guess,
  greaterThan(greaterThan: number): GreaterThanGoal {
    return { type: "greaterThan", greaterThan };
  },
  key([key, value]): KeyGoal {
    return { type: "key", key, goal: pf.guess(value) };
  },
  lessThan(lessThan: number): LessThanGoal {
    return { type: "lessThan", lessThan };
  },
  map: Object.assign(
    function (change: string, options: any, goal: Guessable): MapGoal {
      return { type: "map", change, options, goal: pf.guess(goal) };
    },
    {
      array: (goal: Guessable) => pf.map("array", null, goal),
      filterSkipped: (goal: Guessable) => pf.map("filterUndefined", null, goal),
      flat: (goal: Guessable) => pf.map("flat", null, goal),
      join: (goal: Guessable, joiner = "") => pf.map("join", { joiner }, goal),
      skip: (goal: Guessable) => pf.map("skip", null, goal),
    }
  ),
  named<T extends { [key: string]: Goal }>(
    goals: { [key in keyof T]: Chain | Goal | ((refs: T) => Chain | Goal) }
  ): T {
    const _refs = {} as { [key in keyof T]: ReferenceGoal };
    for (const key of Object.keys(goals) as (keyof T)[]) {
      _refs[key] = { type: "reference", goal: null };
    }
    for (const key of Object.keys(goals) as (keyof T)[]) {
      const item = goals[key];
      const subgoal =
        typeof item === "function"
          ? (item as (refs: T) => Goal)(_refs as T)
          : (item as Goal);
      _refs[key].goal = subgoal instanceof Chain ? subgoal.goal : subgoal;
    }
    return _refs as any;
  },
  nest(bindingMap: [string, string][], goal: Guessable): StateNestGoal {
    return {
      type: "state",
      stateType: "nest",
      bindingMap,
      goal: pf.guess(goal),
    };
  },
  not(goal: Guessable): UnaryGoal {
    return {
      type: "unary",
      unaryType: "logicalNot",
      goal: pf.guess(goal),
    };
  },
  number(): NumberGoal {
    return { type: "number" };
  },
  object<T extends { [key: string]: any }>(
    goal: { [key in keyof T]: Guessable } | ([keyof T, Guessable] | Goal)[],
    extra?: Goal[]
  ): ObjectGoal {
    const goals: Goal[] = (
      Array.isArray(goal) ? goal : Object.entries(goal)
    ).map((sg) => (Array.isArray(sg) ? pf.key(sg) : sg));
    if (extra) {
      goals.push(...extra);
    }
    if (goals.length === 0) {
      return { type: "object" };
    }
    return {
      type: "object",
      goal: pf.map.filterSkipped(pf.sequence(goals)),
    };
  },
  or(goal1: Guessable, goal2: Guessable): BinaryGoal {
    return {
      type: "binary",
      binaryType: "logicalOr",
      goal1: pf.guess(goal1),
      goal2: pf.guess(goal2),
    };
  },
  reference(goalFactory: (goal: Goal) => Goal): ReferenceGoal {
    const refGoal: ReferenceGoal = { type: "reference", goal: null };
    refGoal.goal = goalFactory(refGoal);
    return refGoal;
  },
  retrieve(retrieveKey: string): StoreRetrieveGoal {
    return { type: "state", stateType: "retrieve", retrieveKey };
  },
  sequence(goal: Guessable[]): SequenceGoal {
    return { type: "sequence", sequence: goal.map(pf.guess) };
  },
  some(goal1: Guessable, ...goals: Guessable[]): Goal {
    return goals.reduce(pf.or, goal1) as Goal;
  },
  store(
    goal: Guessable,
    storeKey: string,
    isCollection = false
  ): StateStoreGoal {
    return {
      type: "state",
      stateType: "store",
      goal: pf.guess(goal),
      storeKey,
      isCollection,
    };
  },
  string(goal?: Goal): StringGoal {
    if (!goal) {
      return { type: "string" };
    }
    return { type: "string", goal };
  },
  term(goal: string): TermGoal {
    return { type: "term", term: goal };
  },
  value<T extends string | number | boolean | symbol | undefined>(
    goal: T
  ): ValueGoal<T> {
    return { type: "value", value: goal };
  },
};

class Chain<T extends Goal = Goal> {
  constructor(public goal: T) {}

  get frequency() {
    return new FrequencyChain(this.goal);
  }

  get map() {
    return new MapChain(this.goal);
  }

  string() {
    return new Chain(pf.string(this.goal));
  }
}

class FrequencyChain<T extends Goal = Goal> {
  constructor(public goal: T) {}

  atLeastZero() {
    return new Chain(pf.frequency.atLeastZero(this.goal));
  }
  atLeastOne() {
    return new Chain(pf.frequency.atLeastOne(this.goal));
  }
  atMostOne() {
    return new Chain(pf.frequency.atMostOne(this.goal));
  }
}

class MapChain<T extends Goal = Goal> {
  constructor(public goal: T) {}

  array() {
    return new Chain(pf.map.array(this.goal));
  }
  filterSkipped() {
    return new Chain(pf.map.filterSkipped(this.goal));
  }
  flat() {
    return new Chain(pf.map.flat(this.goal));
  }
  join(joiner?: string) {
    return new Chain(pf.map.join(this.goal, joiner));
  }
  skip() {
    return new Chain(pf.map.skip(this.goal));
  }
}

const pcf = (function <T extends { [key: string]: (...args: any[]) => Goal }>(
  pf: T
): {
  [key in keyof T]: T[key] extends (...args: infer Args) => infer R
    ? R extends Goal
      ? (...args: Args) => Chain<R>
      : never
    : never;
} {
  const o = {} as any;
  for (const key of Object.keys(pf)) {
    o[key] = (...args: any[]) => new Chain(pf[key](...args));
  }
  return o;
})(pf as Omit<typeof pf, "named" | "reference">);

const serialGoal = pf.map("serialize", null, pf.any());
const serialEndOfObject = pf.map.skip(pf.eof());
const serializers = pf.some(
  pf.object<AnyGoal>([["type", "any"], serialEndOfObject]),
  pf.object<BooleanGoal>({ type: pf.value("boolean") }, [serialEndOfObject]),
  pf.object<EOFGoal>({ type: pf.value("endOfFile") }, [serialEndOfObject]),
  pf.object<IntGoal>({ type: pf.value("int") }, [serialEndOfObject]),
  pf.object<NumberGoal>({ type: pf.value("number") }, [serialEndOfObject]),
  pf.object<RealGoal>({ type: pf.value("real") }, [serialEndOfObject]),

  pf.object<GreaterThanGoal>([
    ["type", "greaterThan"],
    ["greaterThan", pf.number()],
    serialEndOfObject,
  ]),
  pf.object<LessThanGoal>(
    { type: pf.value("lessThan"), lessThan: pf.number() },
    [serialEndOfObject]
  ),

  pf.object<UnaryGoal>(
    {
      type: pf.value("unary"),
      unaryType: pf.some(pf.value("logicalNot")),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),
  pf.object<BinaryGoal>(
    {
      type: pf.value("binary"),
      binaryType: pf.some(
        pf.value("logicalAnd"),
        pf.value("logicalOr"),
        pf.value("logicalXor")
      ),
      goal1: serialGoal,
      goal2: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<FrequencyGoal>(
    {
      type: pf.value("frequency"),
      frequencyType: pf.some(
        pf.value("atLeastZero"),
        pf.value("atLeastOne"),
        pf.value("atMostOne")
      ),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<SequenceGoal>(
    {
      type: pf.value("sequence"),
      sequence: pf.array([serialGoal]),
    },
    [serialEndOfObject]
  ),

  pf.object<ReferenceGoal>(
    {
      type: pf.value("reference"),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),
  // pf.nest(
  //   [],
  //   pf.and(
  //     pf.object<ReferenceGoal>(
  //       {
  //         type: pf.value("reference"),
  //         goal: pf.store(serialGoal, "refd"),
  //       },
  //       [serialEndOfObject]
  //     ),
  //     pf.retrieve("refd")
  //   )
  // ),

  pf.object<MapGoal>(
    {
      type: pf.value("map"),
      change: pf.string(),
      options: pf.any(),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<ArrayGoal>(
    {
      type: pf.value("array"),
    },
    [serialEndOfObject]
  ),
  pf.object<ArrayGoal>(
    {
      type: pf.value("array"),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<TermGoal>({ type: pf.value("term"), term: pf.string() }, [
    serialEndOfObject,
  ]),
  pf.object<CharRangeGoal>(
    { type: pf.value("charRange"), end: pf.string(), start: pf.string() },
    [serialEndOfObject]
  ),
  pf.object<FirstGoal>({ type: pf.value("first"), goal: serialGoal }, [
    serialEndOfObject,
  ]),
  pf.object<FirstKeyGoal>({ type: pf.value("firstKey"), goal: serialGoal }),
  pf.object<KeyGoal>(
    {
      type: pf.value("key"),
      key: pf.string(),
    },
    [serialEndOfObject]
  ),
  pf.object<KeyGoal>(
    {
      type: pf.value("key"),
      key: pf.string(),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<ObjectGoal>(
    {
      type: pf.value("object"),
    },
    [serialEndOfObject]
  ),
  pf.object<ObjectGoal>(
    {
      type: pf.value("object"),
      goal: serialGoal,
    },
    [serialEndOfObject]
  ),

  pf.object<StringGoal>({ type: pf.value("string") }, [serialEndOfObject]),
  pf.object<StringGoal>({ type: pf.value("string"), goal: serialGoal }, [
    serialEndOfObject,
  ])
);

function serialize(
  g: Goal,
  cycles: Map<
    Goal,
    {
      id: any;
      goal: Goal | null;
      references: number;
    }
  > = new Map()
) {
  const p = new Parser(serializers, {
    serialize(value, options, env) {
      // console.log("map:serialize", value);
      if (cycles.has(value)) {
        const serial = cycles.get(value);
        serial.references++;
        return serial.id;
      }
      const serialized = {
        id: { type: "serialized" as const },
        goal: null,
        references: 0,
      };
      cycles.set(value, serialized);
      const result = p.parse(value);
      if (result.parsed) {
        serialized.goal = result.result;
      }
      return serialized.id;
    },
  });
  // console.log(g);
  const result = p.parse(g);
  // console.log(Array.from(cycles.values(), (serial) => serial[1]));
  if (result.parsed) {
    let index = 0;
    const goals = Array.from(cycles.values())
      // .filter(({ references }) => references > 0)
      .map(({ id, goal, references }) => {
        if (references > 0) {
          id.index = index++;
        } else {
          // console.log(goal);
          Object.assign(id, goal);
          // for (const key of Object.keys(goal)) {
          //   id[key] = goal[key];
          // }
        }
        return { goal, references };
      })
      .filter(({ references }) => references > 0)
      .map(({ goal }) => goal);
    return {
      goals,
      root: result.result,
    };
  }
}

(function () {
  {
    const p = Parser.guess(
      pf.string(
        pf.frequency("atLeastZero", pf.or(pf.term("abc"), pf.term("def")))
      )
    );
    console.log(p.parse("abcabcdefabc"));
  }
  {
    const csv = new Parser(
      pf.named({
        comma: pf.term(","),
        doubleQuote: pf.term('"'),
        cr: pf.term("\x0d"),
        lf: pf.term("\x0a"),
        crlf: (r) => pcf.sequence([r.cr, r.lf]).map.join(),
        text: pf.charRange("0", "z"),
        escapedDoubleQuote: (r) =>
          pcf.sequence([r.doubleQuote, r.doubleQuote]).map.join(),
        escapedText: (r) =>
          pcf
            .some(r.text, r.comma, r.cr, r.lf, r.escapedDoubleQuote)
            .frequency.atLeastZero()
            .map.join(),
        escaped: (r) =>
          pcf
            .sequence([r.doubleQuote, r.escapedText, r.doubleQuote])
            .map.join(),
        // e2t: (r) => pf.iff(r.escapedText, r.e2t, r.doubleQuote),
        // e2: (r) => pf.then(r.doubleQuote, pf.or(r.e2t, r.doubleQuote)),
        notEscaped: (r) => pf.map.join(pf.frequency.atLeastZero(r.text)),
        // c2: (r) => pf.iff(r.doubleQuote, r.c2e, r.notEscaped),
        cell: (r) => pf.or(r.escaped, r.notEscaped),
        // row2: (r) => pf.or(pf.sequence([r.cell, pf.skip(r.comma), r.row2]), r.cell),
        row: (r) =>
          pf.map.flat(
            pf.sequence([
              r.cell,
              pf.frequency.atLeastZero(
                pf.map.join(pf.sequence([pf.map.skip(r.comma), r.cell]))
              ),
            ])
          ),
        csv: (r) =>
          // pf.sequence([
          //   r.row.map.array(),
          //   pf.sequence([
          //     pf.some(r.crlf, r.cr, r.lf).map.skip(),
          //     r.row,
          //   ]).map.flat().times.atLeastZero(),
          //   pf.eof().map.skip(),
          // ]).map.flat().string()
          pcf
            .sequence([
              pf.map.array(r.row),
              pcf
                .sequence([pcf.some(r.crlf, r.cr, r.lf).map.skip(), r.row])
                .map.flat()
                .frequency.atLeastZero(),
              pcf.eof().map.skip(),
            ])
            .map.flat()
            .string(),
        // pf.string(
        //   pf.map.flat(
        //     pf.sequence([
        //       pf.map.array(r.row),
        //       pf.frequency.atLeastZero(
        //         pf.map.flat(
        //           pf.sequence([
        //             pf.map.skip(pf.some(r.crlf, r.cr, r.lf)),
        //             r.row,
        //           ])
        //           // r.row.map.array()
        //           //   .then(
        //           //     r.cr.or(r.lf)
        //           //       .map.skip()
        //           //       .then(r.row)
        //           //       .map.flat()
        //           //       .times.atLeastZero()
        //           //   )
        //           //   .then(pf.eof().map.skip())
        //           //   .map.flat()
        //           //   .string()
        //           // pf.sequence([pf.some(r.cr, r.lf), r.row]).map.flat().frequency.atLeastZero()
        //         )
        //       ),
        //       pf.map.skip(pf.eof()),
        //     ])
        //   )
        // ),
      }).csv
    );

    console.log(
      csv.parse(`abc,def,ghi
jkl,"mno","p""qr"
`)
    );

    console.log(JSON.stringify(serialize(csv.goal)));
  }

  {
  }
})();
