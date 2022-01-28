import {
  args,
  Arg,
  System,
  autoDropPool,
  matchPool,
  argViewPool,
  arrayViewPool,
  indexArrayViewPool,
  emptyArrayViewPool,
  ViewFactory,
  MatchMap,
  ObjectExpr,
} from "./unify-view";

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
  function objectTests() {
    const [m, n] = [new MatchMap(), new MatchMap()];
    unifyObjects({ a: 1 }, { a: 1 });
    unifyObjects({ a: _0 }, { a: 1 });
    unifyObjects({ ..._0 }, { a: 1 });
    unifyObjects({ a: 1, ..._0 }, { a: 1 });
    unifyObjects({ a: 1, c: 3, ..._0 }, { b: 2, ..._1 });
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
    function unifyObjects(a: ObjectExpr, b: ObjectExpr) {
      console.log("goal", a, b);
      for (const _ of ViewFactory.view(m, a).unify(ViewFactory.view(n, b))) {
        console.log("answer", m.serialize(), n.serialize());
      }
      for (const _ of ViewFactory.view(m, b).unify(ViewFactory.view(n, a))) {
        console.log("answer_reversed", m.serialize(), n.serialize());
      }
    }
  }
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
  function zebraPuzzle() {
    const start2 =
      typeof process === "undefined" ? Date.now() : process.hrtime.bigint();
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
      console.log(
        ((typeof process === "undefined"
          ? Date.now()
          : process.hrtime.bigint()) as any) - (start2 as any)
      );
      console.log(_.serialize());
      break;
    }
  }

  objectTests();
  // zebraPuzzle();

  function logStats() {
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
}
