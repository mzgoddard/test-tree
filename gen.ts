function and(left, right) {
  return function* (t) {
    for (const _ of t(left)) {
      yield* t(right);
    }
  };
}

function or(left, right) {
  return function* (t) {
    yield* t(left);
    yield* t(right);
  };
}

function f(args: [] | any[], block) {
  const argv = new V(args);
  return function (params: [] | any[]) {
    const paramv = new V(params);
    return and(
      newFrame(),
      and(
        match(
          argv,
          paramv,
          (t) => t.frame.data,
          (t) => t.frame.caller.data
        ),
        block
      )
    );
  };
}

class V {
  constructor(public name: any, public data: any = null) {}
  set(v, d = this.data) {
    const n = this.name;
    if (typeof n !== "string") return { undo() {} };
    const old = d[n];
    if (old !== undefined) return { undo() {} };
    d[n] = v;
    return {
      undo() {
        d[n] = old;
      },
    };
  }
  get(data?) {
    if (typeof this.name !== "string") return this.name;
    return (this.data ?? data)[this.name];
  }
  closest(data?) {
    const next = this.get(data);
    if (next instanceof V) {
      return next.closest(data);
    }
    return this.bind(data);
  }
  bind(data) {
    if (this.data) return this;
    return new V(this.name, data);
  }
}

interface Undo {
  undo: () => void;
}

class UndoCollection {
  constructor(public collection: Undo[] = []) {
    this.undo = this.undo.bind(this);
  }
  add(undo: Undo) {
    this.collection.push(undo);
  }
  undo() {
    this.collection.forEach(({ undo }) => undo());
    this.collection.length = 0;
  }
}

function newFrame(): any {
  return function* (t) {
    t.frame.caller.data = {};
    yield;
  };
}

function tree(ary) {
  if (
    ary.length === 0 ||
    ary.length === 1 ||
    (ary.length === 2 && Array.isArray(ary[1]))
  ) {
    return ary;
  }
  return [ary[0], tree(ary.slice(1))];
}

function isV(v: unknown): v is V {
  return v instanceof V;
}

function omit(o, keys) {
  return new Proxy(o, {
    get(o, p) {
      if (p in keys) return undefined;
      return o[p];
    },
    set(o, p, v) {
      if (p in keys) return false;
      o[p] = v;
      return true;
    },
    has(o, p) {
      if (p in keys) return false;
      return p in o;
    },
    ownKeys(o) {
      return Object.keys(o).filter((k) => keys.includes(k));
    },
  });
}

function _match(a, b, aData, bData, undo = new UndoCollection()) {
  const aClosest = isV(a) ? a.closest(aData) : null,
    aValue = aClosest ? aClosest.get() : a;
  aData = aClosest ? aClosest.data : aData;
  const bClosest = isV(b) ? b.closest(bData) : null,
    bValue = bClosest ? bClosest.get() : b;
  bData = bClosest ? bClosest.data : bData;
  if (aValue === bValue && aValue !== undefined) {
    return undo;
  } else if (
    typeof aValue === "object" &&
    aValue !== null &&
    typeof bValue === "object" &&
    bValue !== null
  ) {
    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      if (aValue.length !== bValue.length) {
        undo.undo();
        return false;
      }
      for (let i = 0; i < aValue.length; i++) {
        if (!_match(aValue[i], bValue[i], aData, bData, undo)) {
          undo.undo();
          return false;
        }
      }
      return undo;
    } else if (!Array.isArray(aValue) && !Array.isArray(bValue)) {
      for (const key of Object.keys(aValue)) {
        if (!(key in bValue)) {
          undo.undo();
          return false;
        }
        if (!_match(aValue[key], bValue[key], aData, bData, undo)) {
          undo.undo();
          return false;
        }
      }
      return undo;
    }
  } else if (aClosest && aValue === undefined) {
    if (bClosest) {
      undo.add(aClosest.set(bClosest, aData));
      return undo;
    } else if (bValue !== undefined) {
      undo.add(aClosest.set(bValue, aData));
      return undo;
    }
  } else if (bClosest && bValue === undefined && aValue !== undefined) {
    undo.add(bClosest.set(aValue, bData));
    return undo;
  }
  undo.undo();
  return false;
}

function match(
  a,
  b,
  aGetData = (t) => t.frame.data,
  bGetData = (t) => t.frame.data
) {
  return function* (t) {
    const m = _match(a, b, aGetData(t), bGetData(t));
    if (m) {
      try {
        yield;
      } finally {
        m.undo();
      }
    }
  };
}

interface Frame {
  task: Generator;
  data: any;
  caller: Frame | null;
  next: Frame | null;
  sibling: Frame | null;
}

class Thread {
  frame = {
    task: (function* (t) {})(),
    data: {},
    caller: null,
    next: null,
    sibling: null,
  } as Frame;
  constructor() {
    const t = this;
    this.call = this.call.bind(this);
    Object.defineProperty(this.call, "frame", {
      get() {
        return t.frame;
      },
    });
  }
  call(g) {
    const t = this;
    let i;
    const f = {
      task: {
        [Symbol.iterator]() {
          return f.task;
        },
        next() {
          const before = t.frame;
          if (t.frame !== f.caller) {
            throw new Error("out of order");
          }
          t.frame = f;
          try {
            return i.next();
          } finally {
            t.frame = before;
          }
        },
        return() {
          return i.return();
        },
        throw(e) {
          const before = t.frame;
          if (t.frame !== f.caller) {
            throw new Error("out of order");
          }
          t.frame = f;
          try {
            return i.throw(e);
          } finally {
            t.frame = before;
          }
        },
      },
      data: t.frame.data,
      caller: t.frame,
      next: null,
      sibling: t.frame.next,
    } as Frame;
    t.frame.next = f;
    i = g(t.call);
    return f.task;
  }
}

function t(block, data = {}) {
  const th = new Thread();
  th.frame.data = data;
  return th.call(block);
}

function v(n, d?) {
  if (Array.isArray(n)) {
    return new V(n[0]);
  }
  return new V(n, d);
}

enum Token {
  WORD = "word",
  ARROW = "arrow",
  OP = "op",
  LP = "lp",
  RP = "rp",
  LS = "ls",
  RS = "rs",
  STR = "str",
  NUM = "num",
  AND_OP = "andOp",
  OR_OP = "orOp",
  EQ_OP = "eqOp",
  END = "end",
  EOF = "eof",
  WS = "ws",
}

function* tokenize(content) {
  for (let i = 0; i < content.length; i++) {
    const start = i;
    switch (content[i]) {
      case "=":
        if (content[i + 1] === ">") {
          i++;
          yield Token.ARROW;
          break;
        }
        yield Token.EQ_OP;
        break;
      case ".":
        yield Token.END;
        break;
      case "(":
        yield Token.LP;
        break;
      case ")":
        yield Token.RP;
        break;
      case ",":
        yield Token.AND_OP;
        break;
      case ";":
        yield Token.OR_OP;
      case " ":
      case "\n":
      case "\t":
      case "\r":
        break;
      case '"':
        for (; i < content.length && content[i] !== '"'; i++) {
          if (content[i] === "\\" && content[i + 1] === '"') {
            i += 1;
          }
        }
        yield content.substring(start, i);
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
      case "0":
        for (; i < content.length; i++) {
          switch (content[i]) {
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
            case "0":
              continue;
            case ".":
              const next = content[i];
              if (
                next === "1" ||
                next === "2" ||
                next === "3" ||
                next === "4" ||
                next === "5" ||
                next === "6" ||
                next === "7" ||
                next === "8" ||
                next === "9" ||
                next === "0"
              ) {
                continue;
              }
          }
          break;
        }
        yield content.substring(start, i);
        break;
      case "_":
      case "A":
      case "B":
      case "C":
      case "D":
      case "E":
      case "F":
      case "G":
      case "H":
      case "I":
      case "J":
      case "K":
      case "L":
      case "M":
      case "N":
      case "O":
      case "P":
      case "Q":
      case "R":
      case "S":
      case "T":
      case "U":
      case "V":
      case "W":
      case "X":
      case "Y":
      case "Z":
      case "a":
      case "b":
      case "c":
      case "d":
      case "e":
      case "f":
      case "g":
      case "h":
      case "i":
      case "j":
      case "k":
      case "l":
      case "m":
      case "n":
      case "o":
      case "p":
      case "q":
      case "r":
      case "s":
      case "t":
      case "u":
      case "v":
      case "w":
      case "x":
      case "y":
      case "z":
        for (; i < content.length; i++) {
          switch (content[i]) {
            case "_":
            case "A":
            case "B":
            case "C":
            case "D":
            case "E":
            case "F":
            case "G":
            case "H":
            case "I":
            case "J":
            case "K":
            case "L":
            case "M":
            case "N":
            case "O":
            case "P":
            case "Q":
            case "R":
            case "S":
            case "T":
            case "U":
            case "V":
            case "W":
            case "X":
            case "Y":
            case "Z":
            case "a":
            case "b":
            case "c":
            case "d":
            case "e":
            case "f":
            case "g":
            case "h":
            case "i":
            case "j":
            case "k":
            case "l":
            case "m":
            case "n":
            case "o":
            case "p":
            case "q":
            case "r":
            case "s":
            case "t":
            case "u":
            case "v":
            case "w":
            case "x":
            case "y":
            case "z":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
            case "0":
              continue;
          }
          yield content.substring(start, i);
        }
        break;
    }
  }
  yield Token.EOF;
}

function construct(tokens) {
  for (const t of tokens) {
  }
}
construct.func = function (tokens) {
  return f(construct.args(tokens), construct.expr(tokens));
};
construct.args = function (tokens) {
  const arg = construct.value(tokens);
  if (arg.done) {
    throw new Error("Reached end of tokens");
  }
  if (arg.value === Token.RP) {
    return [];
  }
  const next = tokens.next();
  if (arg.done) {
    throw new Error("Reached end of tokens");
  }
  if (next.value === Token.RP) {
    return [arg.value];
  } else if (next.value === Token.ARG_SEP) {
    return [arg.value, ...construct.args(tokens)];
  }
  throw new Error("Unexpected token");
};
construct.value = function () {};
construct.expr = function () {};

function compile(content) {
  return construct(tokenize(content));
}

// const nth = ref(nth => f([v('v'), v('i'), v('r')], or(match([[v('r'), v('n')], v('i')], [v('v'), 0]), and())));

{
  const _1_2 = f([v("a")], or(match(v("a"), 1), match(v("a"), 2)));
  // f(1).
  // f(2).
  tokenize("(a) => a = 1, a = 2.");
  const o = {} as any;
  for (const _ of t(_1_2([v("b", o)]), o)) {
    console.log(o);
  }
  console.log(o);
}

// swap([a, b | rest], [b, a | rest]).
// swap([a, | rest], [a | swapped]) => swap(rest, swapped).
// remove().
