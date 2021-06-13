import { readFileSync } from "fs";

type ArrayTree<T = any> = [] | [T, ArrayTree<T>];

function recursiveToArrayTree<T>(array: T[]): ArrayTree<T> {
  if (array.length === 0) {
    return [];
  }
  return [array[0], recursiveToArrayTree(array.slice(1))];
}

function loopToArrayTree<T>(array: T[]): ArrayTree<T> {
  let tree: ArrayTree<T> = [];
  for (let i = array.length - 1; i >= 0; i--) {
    tree = [array[i], tree];
  }
  return tree;
}

interface IsTest<V = unknown, T extends V = any> {
  (value: V): value is T;
}

function hasMemberTest<M extends string | number, T>(
  member: M,
  test: IsTest<unknown, T>
): IsTest<unknown, { [member in M]: T }> {
  return function (obj): obj is { [member in M]: T } {
    return (
      typeof obj === "object" &&
      member in obj &&
      test((obj as { [member in M]: any })[member])
    );
  };
}

function treeIncludes<T extends ArrayTree>(
  test: IsTest<ArrayTree, T>
): IsTest<ArrayTree, T> {
  return function repeat(tree): tree is T {
    return test(tree) || repeat(tree[1]);
  };
}

function treeHeadIs(test: IsTest): IsTest {
  return treeIncludes((tree) => test(tree[0]));
}

function treeIncludesBefore(test: IsTest, then: IsTest): IsTest {
  return treeIncludes((tree) => test(tree[0]) && then(tree[1]));
}

function hasMemberValue<M extends string, T>(member: M, value: T) {
  return hasMemberTest(member, (v): v is T => v === value);
}

function isElement(tag: string) {
  return hasMemberValue("shape", tag);
}

function isAllOf<T extends IsTest[]>(
  ...tests: T
): IsTest<unknown, T extends IsTest<unknown, infer V>[] ? V : never> {
  return function (
    obj
  ): obj is T extends IsTest<unknown, infer V>[] ? V : never {
    return tests.every((test) => test(obj));
  };
}

function isOneOf(...tests: any[]) {
  return function (obj) {
    return tests.some((test) => test(obj));
  };
}

const b = { shape: "element" };
const a = isAllOf(
  hasMemberValue("shape", "element" as const),
  hasMemberTest("content", Array.isArray)
);
const c = a(b);

function same(goal: unknown) {
  return assignSymbol(function (value) {
    return value === goal;
  });
}

function assignSymbol(fn) {
  fn[testSymbol] = true;
  return fn;
}

function asArrayTreeTest(test) {
  const treeTest = treeIncludes(test);
  return assignSymbol((ary) => treeTest(loopToArrayTree(ary)));
}

const testSymbol = Symbol.for("$$TestSymbol");

function match(description: unknown): (value: unknown) => boolean {
  if (typeof description === "object" && description !== null) {
    if (Array.isArray(description)) {
      return isEach(
        is.array,
        ...description.map((value, index) =>
          hasMemberTest(index, match(value) as any)
        )
      ) as any;
    }
    return isEach(
      is.object,
      ...Object.keys(description).map((key) =>
        hasMemberTest(key, match(description[key]) as any)
      )
    ) as any;
  }
  if (typeof description === "function" && description[testSymbol]) {
    return description as any;
  }
  return same(description) as any;
}

function isTypeof(
  type:
    | "string"
    | "number"
    | "object"
    | "function"
    | "boolean"
    | "symbol"
    | "undefined"
) {
  return assignSymbol(function (value) {
    return typeof value === type;
  });
}

function createRefs<
  T extends {
    [key: string]: (
      refs: { [key in keyof T]: ReturnType<T[key]> }
    ) => (value: any) => boolean;
  }
>(methods: T): { [key in keyof T]: ReturnType<T[key]> } {
  const o = {};
  for (const key of Object.keys(methods)) {
    o[key] = (value) => {
      o[key] = methods[key](o as any);
      return o[key](value);
    };
  }
  return o as any;
}

function eachIndex(test) {
  return assignSymbol(
    (value) => is.array(value) && value.every((item) => test(item))
  );
}

const is = createRefs({
  undefined: () => same(undefined),
  null: () => same(null),
  any: () => assignSymbol(() => true),
  boolean: () => isTypeof("boolean"),
  number: () => isTypeof("number"),
  string: () => isTypeof("string"),
  array: () => assignSymbol((value) => Array.isArray(value)),
  object: () =>
    assignSymbol((value) => typeof value === "object" && value !== null),
  function: () => isTypeof("function"),
});

const en1 = match({
  type: "element",
  shape: is.string,
  content: isAllOf(is.array),
});
const fn1 = match({
  type: "fragment",
  shape: "fragment",
  content: isAllOf(is.array),
});
const tn1 = match({ type: "text", shape: "text", content: is.string });
const cn1 = match({
  type: "component",
  shape: is.function,
  content: isAllOf(is.array),
});
const an1 = match({ type: "attribute", key: is.string, value: is.string });
const pn1 = match({ type: "property", key: is.string, value: is.any });
const sn1 = match({ type: "style" });
const cln1 = match({ type: "className" });
const rn1 = match({ type: "ref" });

const vr = createRefs({
  element: (refs) =>
    match({
      type: "element",
      shape: is.string,
      content: isAllOf(is.array, eachIndex(isOneOf(refs.branch, refs.leaf))),
    }),
  fragment: (refs) =>
    match({
      type: "fragment",
      shape: "fragment",
      content: isAllOf(is.array, eachIndex(refs.branch)),
    }),
  component: (refs) =>
    match({
      type: "component",
      shape: is.function,
      content: isAllOf(is.array, eachIndex(isOneOf(refs.options))),
    }),
  text: (refs) => match({ type: "text", shape: "text", content: is.string }),
  attribute: (refs) =>
    match({ type: "attribute", key: is.string, value: is.string }),
  property: (refs) =>
    match({ type: "property", key: is.string, value: is.any }),
  options: (refs) => match({ type: "meta", key: "options", value: is.any }),
  branch: (refs) =>
    isOneOf(refs.element, refs.fragment, refs.component, refs.text),
  leaf: (refs) => isOneOf(refs.attribute, refs.property),
});

const rs = createRefs({
  element: (refs) =>
    match({
      type: { name: "element" },
      parent: refs.parent,
      after: refs.branch,
      shape: is.string,
      content: isOneOf(
        is.null,
        isAllOf(is.array, eachIndex(isOneOf(vr.branch, vr.leaf)))
      ),
      ref: isOneOf(is.null),
      refHooks: isOneOf(is.null),
      rewriteChildIndex: is.number,
      children: isAllOf(is.array),
      rewriteMemberIndex: is.number,
      members: isAllOf(is.array),
    }),
  fragment: (refs) =>
    match({
      type: { name: "fragment" },
      parent: refs.parent,
      after: refs.branch,
      shape: "fragment",
      content: isOneOf(is.null, isAllOf(is.array)),
      rewriteChildIndex: is.number,
      children: is.null,
    }),
  component: (refs) =>
    match({
      type: { name: "component" },
      parent: refs.parent,
      after: refs.branch,
      shape: is.function,
      content: isOneOf(is.null),
      rendered: null,
    }),
  text: (refs) =>
    match({
      type: { name: "text" },
      parent: refs.parent,
      after: refs.branch,
      shape: "text",
      content: is.string,
      ref: null,
    }),
  attribute: (refs) =>
    match({
      type: { name: "attribute" },
      parent: refs.element,
      name: is.string,
      value: isOneOf(is.null, is.string),
    }),
  property: (refs) =>
    match({
      type: { name: "property" },
      parent: refs.element,
      name: is.string,
      value: is.any,
    }),
  parent: (refs) => isOneOf(refs.element, refs.fragment, refs.component),
  branch: (refs) =>
    isOneOf(refs.element, refs.fragment, refs.component, refs.text),
  states: (refs) =>
    isOneOf(
      refs.element,
      refs.fragment,
      refs.component,
      refs.text,
      refs.attribute,
      refs.property
    ),
});

function eachIndexPair(a, b) {
  return function (ary) {
    for (let i = 0; i < ary.length; i += 2) {
      if (!a(ary[i]) || !b(ary[i + 1])) {
        return false;
      }
    }
    return true;
  };
}

const q = createRefs({
  queue: (refs) =>
    match({
      prepare: isAllOf(is.array, eachIndexPair(is.function, rs.component)),
      change: isAllOf(is.array, eachIndexPair(is.function, rs.states)),
      post: isAllOf(is.array, eachIndexPair(is.function, rs.states)),
    }),
});

function isProperty(key: string) {
  return function (obj) {
    // return typeof obj === 'object' &&
  };
}
