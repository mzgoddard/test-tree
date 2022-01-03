interface P<Name extends string = string> {
  __type: "atom";
  type: "param";
  name: Name;
}

interface B {
  __type: "atom";
  type: "binding";
  map: Map<P, any>;
  template: any;
}

function p(name = "no_name"): P<string> {
  return { __type: "atom", type: "param", name };
}

function b(template: any, map: Map<P, any>): B {
  return { __type: "atom", type: "binding", template, map };
}

const EMPTY_MAP = new Map<P, any>();

function map(param: P, value: any) {
  return new Map([[param, value]]);
}

function merge(map0: Map<P, any>, ...maps: Map<P, any>[]) {
  if (maps.length > 0) {
    return new Map(
      ...map0.entries(),
      ...merge(maps[0], ...maps.slice(1)).entries()
    );
  }
  return map0;
}

function get(map: Map<P, any>, p: P) {
  if (map.has(p)) {
    const value = map.get(p);
    if (isParam(value)) {
      return get(map, value);
    }
    return value;
  }
  return p;
}

function isParam(value: any) {
  return value && value.__type === "atom" && value.atom === "param";
}

function isSet(map: any, value: any) {
  return isParam(value) && map.has(value);
}

function isUnset(map: any, value: any) {
  return isParam(value) && !map.has(value);
}

function isObject(value: any) {
  return (
    value &&
    typeof value === "object" &&
    !isParam(value) &&
    !isArray(value) &&
    value !== null
  );
}

function isArray(value: any) {
  return value && typeof value === "object" && Array.isArray(value);
}

function isImmutable(value: any) {
  return typeof value !== "object" || value === null;
}

function* match(a, b) {
  if (a === b) {
    yield EMPTY_MAP;
  } else if (isParam(a)) {
  } else if (isParam(b)) {
  } else if (isObject(a) && isObject(b)) {
  } else if (isArray(a) && isArray(b)) {
  }
}
