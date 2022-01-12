// {
//   type Immutable = undefined | null | boolean | number | string | symbol;

//   type ObjectExpr =
//     | { [key: string]: Expr }
//     | {
//         [objectRestKeySymbol]: Arg;
//       };

//   type ArrayExpr = (Expr | RestArg)[];

//   type Expr = Immutable | Arg | ArrayExpr | ObjectExpr;

//   type Stmt = readonly [string, ...Expr[]];

//   type Constructor<T, P extends any[]> = new (...params: P) => T;
//   interface Ref<P extends any[] = any[]> {
//     pool?: Pool<Constructor<this, P>>;

//     reinit(...params: ConstructorParameters<Constructor<this, P>>): this;
//     deinit(): this;
//     retain(): this;
//     release(): asserts this is never;
//   }

//   const DONE_YIELD = { value: null, done: true };

//   class GuardRef<T extends Ref<[ref: T]>>
//     implements Generator<T>, Ref<[ref: T]>
//   {
//     i = 0;
//     refYield: { value: T };
//     pool: Pool<Constructor<this, [ref: T]>> = null;
//     refCount = 0;
//     constructor(ref: T) {
//       ref.retain();
//       this.refYield = { value: ref };
//     }
//     reinit(ref: T) {
//       ref.retain();
//       this.i = 0;
//       this.refYield.value = ref;
//       return this;
//     }
//     deinit() {
//       this.refYield.value.release();
//       this.refYield.value = null;
//       return this;
//     }
//     retain() {
//       this.refCount++;
//       return this;
//     }
//     release() {
//       this.refCount--;
//       if (this.refCount === 0 && this.pool !== null) {
//         this.pool.freeItem(this.deinit());
//       }
//     }
//     next() {
//       if (this.i++ === 0) {
//         return this.refYield;
//       }
//       return DONE_YIELD;
//     }
//     throw(err: any): IteratorResult<T> {
//       this.release();
//       throw err;
//     }
//     return() {
//       this.release();
//       return DONE_YIELD;
//     }
//     [Symbol.iterator]() {
//       this.retain();
//       return this;
//     }
//   }

//   interface Pool<
//     C extends Constructor<T, P>,
//     T extends Ref<P> = C extends Constructor<infer R, any> ? R : never,
//     P extends any[] = ConstructorParameters<C>
//   > {
//     newItem(...params: ConstructorParameters<C>): T;
//     freeItem(item: T): asserts item is never;
//   }

//   class BasePool<
//     C extends Constructor<T, P>,
//     T extends Ref<P> = C extends Constructor<infer R, any> ? R : never,
//     P extends any[] = ConstructorParameters<C>
//   > implements Pool<C, T>
//   {
//     _pool: T[] = [];
//     poolLimit: number;
//     constructor(private newRef: C, { poolLimit }: { poolLimit: number }) {
//       this.poolLimit = poolLimit;
//     }
//     newItem(...params: ConstructorParameters<C>): T {
//       if (this._pool.length > 0) {
//         return this._pool.pop().reinit(...(params as any));
//       }
//       const ref = new this.newRef(...(params as any));
//       ref.pool = this;
//       return ref;
//     }
//     freeItem(item: T): asserts item is never {
//       if (this._pool.length < this.poolLimit) {
//         this._pool.push(item);
//       }
//     }
//   }

//   const yieldOnePool = new BasePool(GuardRef, { poolLimit: 128 });

//   function guardRef<T extends Ref>(ref: T) {
//     return yieldOnePool.newItem(ref);
//   }

//   const objectRestKey = "__UNIFY_VIEW__OBJECT_REST_KEY";
//   const objectRestKeySymbol = Symbol.for(objectRestKey);

//   class Arg {
//     [objectRestKeySymbol]: Arg;

//     constructor(private _id?: number, private _debugId?: any) {
//       this[objectRestKeySymbol] = this;
//       Object.defineProperty(this, "_id", { enumerable: false });
//       Object.defineProperty(this, "_debugId", { enumerable: false });
//     }

//     get id() {
//       return this._id;
//     }

//     get debugId() {
//       return this._debugId;
//     }

//     get rest() {
//       return new RestArg(this);
//     }

//     toJSON() {
//       return `Arg(_${this._debugId})`;
//     }

//     *[Symbol.iterator]() {
//       yield this.rest;
//     }
//   }

//   const MAX_NEW_ARGS = 32;
//   let nextGlobalArgId = 0;
//   function* args() {
//     let i = 0;
//     for (; i < MAX_NEW_ARGS; i++) {
//       yield new Arg(undefined, nextGlobalArgId++);
//     }
//     throw new Error(`Created too many (${i}) args.`);
//   }

//   class RestArg {
//     arg: Arg;
//     constructor(arg: Arg) {
//       this.arg = arg;
//       this[objectRestKeySymbol] = this;
//       Object.defineProperty(this, "arg", { enumerable: false });
//     }
//   }

//   const TRUE = ["true"] as const;

//   class Facts {
//     facts = [];
//     add(statement: Stmt, condition: Stmt = TRUE) {
//       this.facts.push({ statement, condition });
//       return this;
//     }
//     *call(statement: [string, ...Expr[]]) {
//       const scope = new MatchMap();
//       for (const _ of _call(new ArrayView(scope, statement, 0), this)) {
//         yield scope;
//       }
//     }
//   }

//   interface Match {
//     has(arg: Arg): boolean;
//     get(arg: Arg): View;
//   }

//   interface MatchSet extends Match {
//     set(arg: Arg, value: View): this;
//     delete(arg: Arg): this;
//   }

//   class MatchMap implements MatchSet, Ref {
//     map = new Map();
//     pool: Pool<Constructor<this, []>> = null;
//     refCount = 0;
//     changes = 0;
//     constructor() {}
//     has(arg: Arg): boolean {
//       return this.map.has(arg);
//     }
//     get(arg: Arg) {
//       if (!this.has(arg)) {
//         return new ArgView(this, arg);
//       }
//       return this.map.get(arg);
//     }
//     set(arg: Arg, value: View) {
//       this.changes++;
//       this.map.set(arg, value);
//       return this;
//     }
//     delete(arg: Arg) {
//       this.changes--;
//       this.map.delete(arg);
//       return this;
//     }
//     reinit() {
//       return this;
//     }
//     deinit() {
//       if (this.changes > 0) {
//         this.map.clear();
//         this.changes = 0;
//       }
//       return this;
//     }
//     retain() {
//       this.refCount++;
//       return this;
//     }
//     release() {
//       this.refCount--;
//       if (this.refCount === 0 && this.pool !== null) {
//         this.pool.freeItem(this.deinit());
//       }
//     }
//   }

//   const pools = {
//     match: new BasePool(MatchMap, { poolLimit: 128 }),
//   };

//   type ViewOf<T extends Expr | View> = T extends Arg
//     ? ArgView
//     : T extends (infer R)[]
//     ? R extends Expr
//       ? ArrayView<R>
//       : ArrayView<Expr>
//     : T extends { [key: string]: infer R }
//     ? R extends Expr
//       ? ObjectView<R>
//       : ObjectView<Expr>
//     : T extends Immutable
//     ? ImmutableView<T>
//     : never;

//   function viewOf<T extends Expr | View>(match: MatchSet, target: T): ViewOf<T>;
//   function viewOf(match: MatchSet, target: Expr | View) {
//     return ViewFactory.view(match, target);
//     // if (target instanceof View) {
//     //   return target;
//     // } else if (typeof target === "object") {
//     //   if (target === null) {
//     //     return new ImmutableView(match, target as null);
//     //   } else if (Array.isArray(target)) {
//     //     return new ArrayView(match, target, 0);
//     //   } else if (target instanceof Arg) {
//     //     return new ArgView(match, target);
//     //   } else {
//     //     return new ObjectView(match, target);
//     //   }
//     // } else {
//     //   return new ImmutableView(match, target);
//     // }
//   }

//   function serialize(value: View) {
//     return value.serialize();
//   }

//   abstract class View {
//     match: MatchSet;
//     isArg(): this is ArgView {
//       return false;
//     }
//     isArray(): this is ArrayView<any> {
//       return false;
//     }
//     isObject(): this is ObjectView<any> {
//       return false;
//     }
//     isImmutable(): this is ImmutableView<any> {
//       return false;
//     }
//     abstract isSame(other: View): boolean;
//     abstract serialize(): any;
//     abstract unify(other: View);
//   }
//   // [['=', {b: 2, aa : 3, ...p}, {a: 1, b: 2, ...q}]]
//   class ViewFactory {
//     static view(match: MatchSet, target: Expr | View): View {
//       if (target instanceof View) {
//         return target;
//       } else if (typeof target === "object") {
//         if (target === null) {
//           return new ImmutableView(match, target as null);
//         } else if (Array.isArray(target)) {
//           return ViewFactory.array(match, target, 0);
//         } else if (target instanceof Arg) {
//           return ViewFactory.arg(match, target);
//         } else {
//           return new ObjectView(match, target);
//         }
//       } else {
//         return new ImmutableView(match, target);
//       }
//     }
//     static arg(match: MatchSet, target: Arg): View {
//       if (match.has(target)) {
//         const view = match.get(target);
//         if (view.isArg()) {
//           return view.get();
//         }
//       }
//       return new ArgView(match, target);
//     }
//     static array<T extends Expr | RestArg>(
//       match: MatchSet,
//       target: T[],
//       index: number
//     ) {
//       if (target.length === index) {
//         return new EmptyArrayView(match, target, index);
//       } else if (target[index] instanceof RestArg) {
//         return new ArgView(match, (target[index] as RestArg).arg).get();
//       }
//       return new IndexArrayView(match, target, index);
//     }
//   }
//   class ArgView extends View {
//     constructor(public match: MatchSet, public target: Arg) {
//       super();
//     }
//     static of(match: MatchSet, target: Arg) {
//       if (match.has(target)) {
//         const view = match.get(target);
//         if (view.isArg()) {
//           return view.get();
//         }
//       }
//       return new ArgView(match, target);
//     }
//     isArg(): this is ArgView {
//       return true;
//     }
//     isSame(other: View) {
//       return (
//         other.isArg() &&
//         other.match === this.match &&
//         other.target === this.target
//       );
//     }
//     serialize() {
//       const value = this.get();
//       if (value.isArg()) {
//         return { debugId: value.target.debugId };
//       }
//       return value.serialize();
//     }
//     *unify(other: View): Generator<boolean> {
//       if (
//         other.isArg() &&
//         other.match === this.match &&
//         other.target === this.target
//       ) {
//         yield true;
//       } else if (this.bound()) {
//         yield* this.get().unify(other);
//       } else {
//         yield* this.guard(other);
//       }
//     }
//     bound() {
//       return this.match.has(this.target);
//     }
//     get(): View {
//       if (!this.match.has(this.target)) {
//         return this;
//       }
//       const value = this.match.get(this.target) as View;
//       if (value.isArg()) {
//         return value.get();
//       }
//       return value;
//     }
//     set(value: View) {
//       if (value.isSame(this)) {
//         throw new Error("Cannot evaluate to self.");
//       }
//       this.match.set(this.target, value);
//     }
//     delete() {
//       this.match.delete(this.target);
//     }
//     *guard(value: View) {
//       this.set(value);
//       try {
//         yield true;
//       } finally {
//         this.delete();
//       }
//     }
//   }

//   class ArrayView<T extends Expr | RestArg = Expr | RestArg> extends View {
//     constructor(
//       public match: MatchSet,
//       public target: T[],
//       public start: number
//     ) {
//       super();
//     }
//     isArray(): this is ArrayView<Expr> {
//       return true;
//     }
//     isSame(other: View) {
//       return (
//         other.isArray() &&
//         other.match === this.match &&
//         other.target === this.target &&
//         other.start === this.start
//       );
//     }
//     serialize() {
//       if (this.target.length === this.start) {
//         return [];
//       }
//       const lastIndex = this.target.length - 1;
//       const lastItem = this.target[lastIndex];
//       if (lastItem instanceof RestArg) {
//         return this.target
//           .slice(this.start, lastIndex)
//           .map((entry) => viewOf(this.match, entry as Expr).serialize())
//           .concat(...new ArgView(this.match, lastItem.arg).serialize());
//       }
//       return this.target
//         .slice(this.start)
//         .map((entry) => viewOf(this.match, entry as Expr).serialize());
//     }
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       } else if (other.isArray()) {
//         if (!this.empty() && !other.empty()) {
//           for (const _ of this.first().unify(other.first())) {
//             yield* this.rest().unify(other.rest());
//           }
//         } else if (this.empty() && this.more()) {
//           yield* this.rest().unify(other);
//         } else if (other.empty() && other.more()) {
//           yield* this.unify(other.rest());
//         } else if (this.empty() && other.empty()) {
//           yield true;
//         }
//       }
//     }
//     empty() {
//       return (
//         this.target.length === this.start ||
//         this.target[this.start] instanceof RestArg
//       );
//     }
//     more() {
//       return this.target[this.start] instanceof RestArg;
//     }
//     first(): View {
//       return viewOf(this.match, this.target[this.start] as Expr);
//     }
//     rest<R = T extends string ? ArrayView<string> : never>(): R;
//     rest(): View;
//     rest(): View {
//       if (this.target[this.start] instanceof RestArg) {
//         return new ArgView(
//           this.match,
//           (this.target[this.start] as RestArg).arg
//         ).get();
//       } else if (this.target[this.start + 1] instanceof RestArg) {
//         return new ArgView(
//           this.match,
//           (this.target[this.start + 1] as RestArg).arg
//         ).get();
//       }
//       return new ArrayView(this.match, this.target, this.start + 1);
//     }
//   }

//   class IndexArrayView<T extends Expr | RestArg> extends ArrayView<T> {
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       } else if (other.isArray()) {
//         if (!other.empty()) {
//           for (const _ of this.first().unify(other.first())) {
//             yield* this.rest().unify(other.rest());
//           }
//         } else if (other.empty() && other.more()) {
//           yield* this.unify(other.rest());
//         }
//       }
//     }
//     empty() {
//       return false;
//     }
//     more() {
//       return true;
//     }
//   }

//   class RestArrayView<T extends Expr | RestArg> extends ArrayView<T> {
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       } else if (other.isArray()) {
//         yield* this.rest().unify(other);
//       }
//     }
//     empty() {
//       return true;
//     }
//     more() {
//       return true;
//     }
//   }

//   class EmptyArrayView<T extends Expr | RestArg> extends ArrayView<T> {
//     serialize() {
//       return [];
//     }
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       } else if (other.isArray()) {
//         if (other.empty() && other.more()) {
//           yield* this.unify(other.rest());
//         }
//       }
//     }
//     empty() {
//       return true;
//     }
//     more() {
//       return false;
//     }
//     rest() {
//       return this;
//     }
//   }

//   class ObjectView<V extends Expr> extends View {
//     constructor(
//       public match: MatchSet,
//       public target: ObjectExpr,
//       public keys = new ArrayView(match, Object.keys(target).sort(), 0)
//     ) {
//       super();
//     }
//     isObject(): this is ObjectView<Expr> {
//       return true;
//     }
//     isSame(other: View) {
//       return (
//         other.isObject() &&
//         other.match === this.match &&
//         other.target === this.target
//       );
//     }
//     serialize() {
//       return {
//         ...(this.empty()
//           ? {}
//           : { [this.firstKey()]: this.firstValue().serialize() }),
//         ...(this.more() ? this.rest().serialize() : {}),
//       };
//     }
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       } else if (other.isObject()) {
//         if (!this.empty() && !other.empty()) {
//           const thisKey = this.firstKey();
//           const otherKey = other.firstKey();
//           if (thisKey === otherKey) {
//             for (const _ of this.firstValue().unify(other.firstValue())) {
//               yield* this.rest().unify(other.rest());
//             }
//           }
//         } else if (this.empty() && other.empty()) {
//           yield true;
//         }
//       }
//     }
//     empty() {
//       return this.keys.target.length === this.keys.start;
//     }
//     more() {
//       return false;
//       // return this.target[objectRestKeySymbol] instanceof Arg;
//     }
//     firstKey(): string {
//       return this.keys.first().serialize();
//     }
//     firstValue() {
//       return ViewFactory.view(this.match, this.target[this.firstKey()]);
//     }
//     // first() {
//     //   return new ObjectKeyView(this.match, this.target, this.firstKey());
//     // }
//     rest() {
//       // if (this.empty() && this.more()) {
//       //   return new ObjectRestView(this.match, this.target).rest();
//       // }
//       return new ObjectView(this.match, this.target, this.keys.rest());
//     }
//   }

//   const EMPTY_ARRAY_VIEW = new ArrayView(null, [], 0);
//   const EMPTY_OBJECT_VIEW = new ObjectView(null, {}, EMPTY_ARRAY_VIEW);

//   class ImmutableView<T extends Immutable = Immutable> extends View {
//     constructor(public match: MatchSet, public value: T) {
//       super();
//     }
//     isImmutable() {
//       return true;
//     }
//     isSame(other: View) {
//       return other.isImmutable() && other.value === this.value;
//     }
//     serialize() {
//       return this.value;
//     }
//     *unify(other: View) {
//       if (other.isArg()) {
//         yield* other.unify(this);
//       } else if (this.isSame(other)) {
//         yield true;
//       }
//     }
//   }

//   // [';',
//   //   ['isSame', left, right],
//   // [';',
//   //   [',', ['isBound', left], [',', ['binding', left, left2], ['=', left2, right]]],
//   // [';',
//   //   [',', ['isUnbound', left], ['bind', left, right]],
//   // [';',
//   //   [',', ['isArg', right], ['=', right, left]],
//   // [';',
//   //   [',', [',', ['isArray', left], ['isArray', right]], [
//   //     [';',
//   //
//   //     ]
//   //   ]],
//   // ]
//   // ]
//   // ]
//   // ]
//   // ];

//   // [
//   //   ["->js", ["=", _0, _1], _options, _js],
//   //   [
//   //     ",",
//   //     ["get", _options, "generator", true],
//   //     [
//   //       ";",
//   //       [
//   //         ",",
//   //         ["isArray", _0],
//   //         ["->js", ["ArrayView.isSame", _0, _1], _options, _isSame],
//   //         [
//   //           "=",
//   //           _js,
//   //           [
//   //             "if (",
//   //             _isSame,
//   //             ") {",
//   //             "yield true;",
//   //             "}",
//   //             "else if (",
//   //             _1,
//   //             ".isArg()) {",
//   //             "}",
//   //           ],
//   //         ],
//   //       ],
//   //     ],
//   //   ],
//   // ][
//   //   (["call", [_id, ..._params]],
//   //   [
//   //     ",",
//   //     ["fact", _id, _fact],
//   //     [
//   //       ",",
//   //       ["fact.statement", _fact, [_id, ..._params]],
//   //       [",", ["fact.condition", _fact, _condition], ["call", _condition]],
//   //     ],
//   //   ])
//   // ];

//   // function* and(left, right) {
//   // }

//   function* _unify<S extends View, T extends View>(left: S, right: T) {
//     yield* left.unify(right);
//     // if (left.isSame(right)) {
//     //   yield true;
//     // } else if (left.isArg()) {
//     //   if (left.bound()) {
//     //     yield* _unify(left.get(), right);
//     //   } else {
//     //     yield* left.guard(right);
//     //   }
//     // } else if (right.isArg()) {
//     //   yield* _unify(right, left);
//     // } else if (left.isArray() && right.isArray()) {
//     //   if (!left.empty() && !right.empty()) {
//     //     for (const _ of _unify(left.first(), right.first())) {
//     //       yield* _unify(left.rest(), right.rest());
//     //     }
//     //   } else if (left.empty() && left.more()) {
//     //     yield* _unify(left.rest(), right);
//     //   } else if (right.empty() && right.more()) {
//     //     yield* _unify(left, right.rest());
//     //   } else if (left.empty() && right.empty()) {
//     //     yield true;
//     //   }
//     // } else if (left.isObject() && right.isObject()) {
//     //   if (left.keys.empty() && right.keys.empty()) {
//     //     yield true;
//     //   } else if (!left.keys.empty() && !right.keys.empty()) {
//     //     if (left.keys.first() === right.keys.first()) {
//     //       for (const _ of _unify(left.firstValue(), right.firstValue())) {
//     //         yield* _unify(left.rest(), right.rest());
//     //       }
//     //     }
//     //   }
//     // }
//   }

//   class CutError extends Error {}

//   function calc(formula) {
//     let [op, left, right] = formula;
//     if (Array.isArray(left)) {
//       left = calc(left as ["string", any, any]);
//     } else if (Array.isArray(right)) {
//       right = calc(right as ["string", any, any]);
//     }
//     switch (op) {
//       case "+":
//         return left + right;
//       case "-":
//         return left - right;
//       case "*":
//         return left * right;
//       case "/":
//         return left / right;
//       default:
//         throw new Error(`Cannot calculate ${JSON.stringify(formula)}.`);
//     }
//   }

//   const [params, left, right, more] = args();
//   const llOps: [
//     (Expr | RestArg)[],
//     (statement: ArrayView, facts: Facts) => Generator<boolean>
//   ][] = [
//     [
//       [",", left, right, ...more],
//       function* _comma(statement, facts) {
//         const scope = statement.match;
//         for (const _ of _call(scope.get(left) as ArrayView<any>, facts)) {
//           const moreValue = scope.get(more);
//           if (moreValue.isArray() && !moreValue.empty()) {
//             yield* _call(
//               ViewFactory.array(scope, [",", right, ...more], 0) as ArrayView,
//               facts
//             );
//           } else {
//             yield* _call(scope.get(right) as ArrayView<any>, facts);
//           }
//         }
//       },
//     ],
//     [
//       [";", left, right],
//       function* _comma(statement, facts) {
//         const scope = statement.match;
//         yield* _call(scope.get(left) as ArrayView<any>, facts);
//         yield* _call(scope.get(right) as ArrayView<any>, facts);
//       },
//     ],
//     [
//       ["=", left, right],
//       function* _assign(statement, facts) {
//         const scope = statement.match;
//         yield* _unify(scope.get(left), scope.get(right));
//       },
//     ],
//     [
//       ["is", left, right],
//       function* _settle(statement, facts) {
//         const scope = statement.match;
//         let leftFormula = scope.get(left);
//         if (leftFormula.isArg()) {
//           leftFormula = leftFormula.get();
//         }
//         let rightFormula = scope.get(right);
//         if (rightFormula.isArg()) {
//           rightFormula = rightFormula.get();
//         }
//         const leftValue = leftFormula.isArray()
//           ? new ImmutableView(leftFormula.match, calc(serialize(leftFormula)))
//           : leftFormula;
//         const rightValue = rightFormula.isArray()
//           ? new ImmutableView(rightFormula.match, calc(serialize(rightFormula)))
//           : rightFormula;
//         yield* _unify(leftValue, rightValue);
//       },
//     ],
//     [
//       ["true", ...params],
//       function* _true() {
//         yield true;
//       },
//     ],
//     [["false", ...params], function* _false() {}],
//     [
//       ["!", left],
//       function* _not(statement, facts) {
//         for (const _ of _call(statement.match.get(left) as ArrayView, facts)) {
//           return;
//         }
//         yield true;
//       },
//     ],
//     [
//       ["cut", ...params],
//       function* _cut() {
//         yield true;
//         throw new CutError();
//       },
//     ],
//     [
//       ["log", ...params],
//       function* _log(statement) {
//         console.log(...serialize(statement.match.get(params)));
//         yield true;
//       },
//     ],
//   ];

//   function* _call(statement: ArrayView, facts: Facts) {
//     for (const scope of guardRef(pools.match.newItem())) {
//       for (const [llOp, llAction] of llOps) {
//         const llOpView = new ArrayView(scope, llOp, 0);
//         for (const _ of _unify(llOpView, statement)) {
//           yield* llAction(llOpView, facts);
//           return;
//         }
//       }

//       try {
//         for (const fact of facts.facts) {
//           for (const _ of _unify(
//             new ArrayView(scope, fact.statement, 0),
//             statement
//           )) {
//             yield* _call(new ArrayView(scope, fact.condition, 0), facts);
//           }
//         }
//       } catch (err) {
//         if (err instanceof CutError) {
//           return;
//         }
//         throw err;
//       }
//     }
//   }

//   {
//     const [_0, _1, _2, _3, _4] = args();
//     const m = new MatchMap();
//     const n = new MatchMap();
//     for (const _ of _unify(viewOf(m, [1, _0]), viewOf(n, [_1, _1, ..._2]))) {
//       console.log(
//         serialize(viewOf(m, [_0, _1, _2])),
//         serialize(viewOf(n, [_0, _1, _2]))
//       );
//     }
//     for (const _ of _unify(viewOf(m, { a: _0 }), viewOf(n, { a: 1 }))) {
//       console.log(
//         serialize(viewOf(m, [_0, _1, _2])),
//         serialize(viewOf(n, [_0, _1, _2]))
//       );
//     }
//     // for (const _ of _unify(viewOf(m, { ..._0 }), viewOf(n, { a: 1 }))) {
//     //   console.log(
//     //     serialize(viewOf(m, [_0, _1, _2])),
//     //     serialize(viewOf(n, [_0, _1, _2]))
//     //   );
//     // }
//     // for (const _ of _unify(
//     //   viewOf(m, { a: 1, c: 3, ..._0 }),
//     //   viewOf(n, { b: 2, ..._1 })
//     // )) {
//     //   console.log(
//     //     serialize(viewOf(m, [_0, _1, _2])),
//     //     serialize(viewOf(n, [_0, _1, _2]))
//     //   );
//     // }
//     // for (const _ of _unify(
//     //   viewOf(m, [{ a: 1, c: 3, ..._0 }, _0]),
//     //   viewOf(n, [
//     //     { b: 2, ..._1 },
//     //     { d: 4, e: 5, ..._2 },
//     //   ])
//     // )) {
//     //   console.log(
//     //     serialize(viewOf(m, [_0, _1, _2])),
//     //     serialize(viewOf(n, [_0, _1, _2]))
//     //   );
//     // }
//     for (const _ of _call(
//       viewOf(m, [",", ["value", _0, ..._1], ["log", _0, _1]]),
//       new Facts().add(["value", 1]).add(["value", 2])
//     )) {
//     }
//     const start = process.hrtime.bigint
//       ? process.hrtime.bigint()
//       : process.hrtime();
//     // const startMs = Date.now();
//     for (const _ of _call(
//       viewOf(m, [
//         ",",
//         [
//           "get",
//           [
//             1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
//             20,
//           ],
//           ..._0,
//         ],
//         ["true"],
//       ]),
//       new Facts().add(
//         ["get", [_0, ..._1], _2, _3],
//         [
//           ";",
//           [",", ["is", _2, 0], ["=", _3, _0]],
//           [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
//         ]
//       )
//     )) {
//     }
//     console.log(
//       ((process.hrtime.bigint
//         ? process.hrtime.bigint()
//         : process.hrtime()) as any) - (start as any)
//       // Date.now() - startMs
//     );
//     for (const _ of new Facts()
//       .add(
//         ["get", [_0, ..._1], _2, _3],
//         [
//           ";",
//           [",", ["is", _2, 0], ["=", _3, _0]],
//           [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
//         ]
//       )
//       .call([",", ["get", [1, 2, 3, 4], ..._0], ["log", _0]])) {
//     }
//     for (const _ of new Facts()
//       .add(
//         ["get", [_0, ..._1], _2, _3],
//         [
//           ";",
//           [",", ["is", _2, 0], ["=", _3, _0]],
//           [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
//         ]
//       )
//       .call([",", ["get", [1, 2, 3, 4], _0, 2], ["log", _0]])) {
//     }
//     for (const _ of new Facts()
//       .add(
//         ["get", [_0, ..._1], _2, _3],
//         [
//           ";",
//           [",", ["is", _2, 0], ["=", _3, _0]],
//           [",", ["get", _1, _4, _3], ["is", _2, ["+", _4, 1]]],
//         ]
//       )
//       .call([",", ["get", [1, 2, 3, 4], 2, _0], ["log", _0]])) {
//     }
//     const start2 = process.hrtime.bigint();
//     const a = () => new Arg();
//     const [houses, drinksWater, zebraOwner, _5, _6, _7, _8, _9] = args();
//     for (const _ of new Facts()
//       .add(["house", _0, [_0, _1, _2, _3, _4]])
//       .add(["house", _0, [_1, _0, _2, _3, _4]])
//       .add(["house", _0, [_1, _2, _0, _3, _4]])
//       .add(["house", _0, [_1, _2, _3, _0, _4]])
//       .add(["house", _0, [_1, _2, _3, _4, _0]])
//       .add(["leftOf", _0, _1, [_0, _1, _2, _3, _4]])
//       .add(["leftOf", _0, _1, [_2, _0, _1, _3, _4]])
//       .add(["leftOf", _0, _1, [_2, _3, _0, _1, _4]])
//       .add(["leftOf", _0, _1, [_2, _3, _4, _0, _1]])
//       .add(["rightOf", _0, _1, [_1, _0, _2, _3, _4]])
//       .add(["rightOf", _0, _1, [_2, _1, _0, _3, _4]])
//       .add(["rightOf", _0, _1, [_2, _3, _1, _0, _4]])
//       .add(["rightOf", _0, _1, [_2, _3, _4, _1, _0]])
//       .add(["first", _0, [_0, _1, _2, _3, _4]])
//       .add(["middle", _0, [_1, _2, _0, _3, _4]])
//       .add(["nextTo", _0, _1, _2], ["leftOf", _0, _1, _2])
//       .add(["nextTo", _0, _1, _2], ["rightOf", _0, _1, _2])
//       .add(
//         ["problem", houses],
//         [
//           ",",
//           ["house", ["brit", a(), a(), "red", a()], houses],
//           // ["log", houses],
//           ["house", ["spaniard", "dog", a(), a(), a()], houses],
//           // ["log", houses],
//           ["house", [a(), a(), "coffee", "green", a()], houses],
//           // ["log", houses],
//           ["house", ["ukrainian", a(), "tea", a(), a()], houses],
//           // ["log", houses],
//           [
//             "rightOf",
//             [a(), a(), a(), "green", a()],
//             [a(), a(), a(), "ivory", a()],
//             houses,
//           ],
//           // ["log", houses],
//           ["house", [a(), "snails", a(), a(), "oatmeal"], houses],
//           // ["log", houses],
//           ["house", [a(), a(), a(), "yellow", "chocolate chip"], houses],
//           // ["log", houses],
//           ["middle", [a(), a(), "milk", a(), a()], houses],
//           ["first", ["norwegian", a(), a(), a(), a()], houses],
//           [
//             "nextTo",
//             [a(), a(), a(), a(), "sugar"],
//             [a(), "fox", a(), a(), a()],
//             houses,
//           ],
//           [
//             "nextTo",
//             [a(), a(), a(), a(), "chocolate chip"],
//             [a(), "horse", a(), a(), a()],
//             houses,
//           ],
//           ["house", [a(), a(), "orange juice", a(), "peanut"], houses],
//           ["house", ["japanese", a(), a(), a(), "frosted"], houses],
//           [
//             "nextTo",
//             ["norwegian", a(), a(), a(), a()],
//             [a(), a(), a(), "blue", a()],
//             houses,
//           ],
//         ]
//       )
//       .call([
//         ",",
//         ["problem", houses],
//         ["house", [zebraOwner, "zebra", a(), a(), a()], houses],
//         ["house", [drinksWater, a(), "water", a(), a()], houses],
//         ["log", zebraOwner, drinksWater],
//       ])) {
//       console.log(process.hrtime.bigint() - start2);
//     }
//     // [
//     //   _2,
//     //   "is",
//     //   0,
//     //   ",",
//     //   _3,
//     //   "=",
//     //   _0,
//     //   ";",
//     //   ["get", _1, _4, _3],
//     //   ",",
//     //   [_2, "is", _4, "+", 1],
//     // ];
//     // [
//     //   ["rewrite", _0, _0],
//     //   [",", ["=", [_1, ..._2], _0], [",", ["isString", _1], ["cut"]]],
//     // ];
//     // [
//     //   ["rewrite", [_0, _1, ",", ..._2], _3],
//     //   [",", ["rewrite", []]],
//     // ];
//     // [["rewrite", [_0, "is", _1], ["is", _0, _1]]];
//     // [["rewrite", [_0, ",", _1], [",", _0, _1]]];
//     // [["rewrite", [_0, "is", _1], ["is", _0, _1]]];
//     // [["rewrite", [_0, "=", _1], ["=", _0, _1]]];
//     // [["rewrite", _0, _0]];
//   }
// }
