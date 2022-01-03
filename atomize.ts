// const choose = () => {}
// const equalobj = (a, b) => {}
// const unify = (a, b) => {}

// const installed = {atom: 'installed'}
// const uninstalled = {atom: 'uninstalled'}
// const fileExists = {atom: 'fileExists', path: 'file:///*', size: 'number'}

export const param = (name, value = undefined) => {
  return { __atom: true, atom: "param", name, value };
};
export const atomize = (o, r = new Map()) => {
  if (!r.has(o)) {
    if (o && o.__atom) {
      r.set(o, o);
    } else if (typeof o === "object") {
      if (o === null) {
        r.set(o, atomizeImmutable(o));
      } else if (Array.isArray(o)) {
        r.set(o, atomizeArray(o, 0, r));
      } else {
        r.set(o, atomizeObject(o, atomizeArray(Object.keys(o), r), r));
      }
    } else {
      r.set(o, atomizeImmutable(o));
    }
  }
  return r.get(o);
};
const atomizeArray = (o, i, r = new Map()) => {
  if (i < o.length) {
    return {
      __atom: true,
      atom: "arrayCell",
      get value() {
        return atomize(o[i], r);
      },
      get next() {
        return atomizeArray(o, i + 1, r);
      },
    };
  }
  return { __atom: true, atom: "arrayEnd" };
};
const atomizeObject = (o, keys, r) => {
  if (keys.atom === "arrayCell") {
    return {
      __atom: true,
      atom: "objectProperty",
      key: keys.value,
      get value() {
        return atomize(o[keys.value], r);
      },
      get next() {
        return atomizeObject(o, keys.next, r);
      },
    };
  }
  return { __atom: true, atom: "objectEnd" };
};
const atomizeImmutable = (value) => {
  return { __atom: true, atom: "value", value };
};
export const deatomize = (o, r = new Map()) => {
  if (!r.has(o)) {
    if (o.atom === "arrayCell" || o.atom === "atomEnd") {
      r.set(o, []);
      deatomizeArray(r.get(o), o, r);
    } else if (o.atom === "objectProperty" || o.atom === "objectEnd") {
      r.set(o, {});
      deatomizeObject(r.get(o), o, r);
    } else if (o.atom === "param") {
      if (o.value !== undefined) {
        return deatomize(o.value, r);
      }
      return o.value;
    } else {
      r.set(o, o.value);
    }
  }
  return r.get(o);
};

const deatomizeArray = (out, o, r) => {
  if (o.atom === "arrayCell") {
    out.push(deatomize(o.value, r));
    deatomizeArray(out, o.next, r);
  }
};

const deatomizeObject = (out, o, r) => {
  if (o.atom === "objectProperty") {
    out[o.key] = deatomize(o.value, r);
    deatomizeObject(out, o.next, r);
  }
};

export function* unify(a, b) {
  if (a.atom === "arrayCell") {
    if (b.atom === "arrayCell") {
      for (const _ of unify(a.value, b.value)) {
        yield* unify(a.next, b.next);
      }
    } else if (b.atom === "param") {
      yield* unify(b, a);
    }
  } else if (a.atom === "arrayEnd") {
    if (b.atom === "arrayEnd") {
      yield true;
    } else if (b.atom === "param") {
      yield* unify(b, a);
    }
  } else if (a.atom === "objectProperty") {
  } else if (a.atom === "objectEnd") {
    if (b.atom === "objectEnd") {
      yield true;
    } else if (b.atom === "param") {
      yield* unify(b, a);
    }
  } else if (a.atom === "value") {
    if (b.atom === "value") {
      if (a.value === b.value) {
        yield true;
      }
    } else if (b.atom === "param") {
      yield* unify(b, a);
    }
  } else if (a.atom === "param") {
    if (a.value !== undefined) {
      yield* unify(a.value, b);
    } else if (b.atom === "param") {
      if (b.value !== undefined) {
        yield* unify(a, b.value);
      } else {
        try {
          a.value = b;
          yield true;
        } finally {
          a.value = undefined;
        }
      }
    }
  }
}

// function* get(o, k, v) {
//     for (let ) {}
// }
