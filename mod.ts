function unshift() {}
function push(factory) {
  return function (ary) {
    if (!ary) {
      return [factory()];
    }
    return [...ary, factory()];
  };
}
function each(f) {}
function map(g) {
  return function* (o) {
    for (let i = 0; i < o.length; i++) {
      for (const m of g(o[i])) {
        yield [...o.slice(0, i), m, ...o.slice(i + 1)];
      }
    }
  };
}
function deep(g) {
  const repeat = chain(
    map(function* (o) {
      if (Array.isArray(o)) {
        yield* repeat(o);
      } else {
        yield o;
      }
    }),
    g
  );
  return repeat;
}
function* swap(o) {
  if (o.length < 2) {
    yield o;
  } else if (o.length === 2) {
    yield [o[1], o[0]];
  } else {
    for (let i = 0; i < o.length; i++) {
      if (i + 1 === o.length) {
        yield [o[i], ...o.slice(1, i), o[0]];
      } else {
        yield [...o.slice(0, i), o[i + 1], o[i], ...o.slice(i + 2)];
      }
    }
  }
}
function chain(...fns) {
  return function* (o) {
    for (let i = 0; i < fns.length; i++) {
      yield* fns[i](o);
    }
  };
}
function skip(n, g) {
  return function* (o) {
    let i = n;
    let v = g(o);
    while (i--) {
      const n = v.next();
      if (n.done) {
        break;
      }
    }
    yield* v;
  };
}
function take(n, g) {
  return function* (o) {
    let i = n;
    let v = g(o);
    while (i--) {
      const n = v.next();
      if (!n.done) {
        yield n.value;
      } else {
        break;
      }
    }
  };
}
function remove() {}
function find(target) {}
function identity(o) {
  return o;
}
function noop() {
  return function* (o) {
    yield o;
  };
}
function times(f, n) {
  if (n === 0) return identity;
  const r = times(f, n - 1);
  return function (o) {
    return r(f(o));
  };
}

let i = 0;
const s = times(
  push(
    times(
      push(() => ({ a: i++ })),

      2
    )
  ),
  2
)();

function exhaust(g) {
  return function (o) {};
}

function countUp(limit) {
  return function* (o) {
    for (let i = 0; i < limit; i++) {
      yield i;
    }
  };
}

const c = chain(
  noop,
  swap,
  map(() => ({ b: 2 }))
);
// console.log(s);
console.log(Array.from(take(5, skip(5, countUp(100)))([])));
// console.log(
//   JSON.stringify(
//     Array.from(
//       take(
//         10,
//         deep(function* () {
//           yield { b: 2 };
//         })
//       )(s)
//     ),
//     null,
//     "  "
//   )
// );
console.log(JSON.stringify(Array.from(take(10, deep(swap))(s)), null, "  "));
