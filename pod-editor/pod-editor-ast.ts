export type PodValue =
  | PodId
  | PodLiteral
  | PodEnd
  | PodProperty
  | PodIndex
  | PodChar
  | PodArg
  | PodAtom
  | PodCase;

export type PodLiteral =
  | PodBoolean
  | PodNull
  | PodNumber
  | PodString
  | PodSymbol
  | PodUndefined;

export enum PodType {
  ARGUMENTS = "arguments",
  ARRAY = "array",
  ATOM = "atom",
  BOOLEAN = "boolean",
  CASE = "case",
  NUMBER = "number",
  OBJECT = "object",
  STRING = "string",
  SYMBOL = "symbol",
  UNDEFINED = "undefined",
}

export interface PodId {
  id: number;
}

export interface PodBoolean {
  id: number;
  pod: "literal";
  type: PodType.BOOLEAN;
  value: boolean;
}

export interface PodNumber {
  id: number;
  pod: "literal";
  type: PodType.NUMBER;
  value: number;
}

export interface PodNull {
  id: number;
  pod: "literal";
  type: PodType.OBJECT;
  value: null;
}

export interface PodString {
  id: number;
  pod: "literal";
  type: PodType.STRING;
  value: string;
}

export interface PodSymbol {
  id: number;
  pod: "literal";
  type: PodType.SYMBOL;
  value: symbol;
}

export interface PodUndefined {
  id: number;
  pod: "literal";
  type: PodType.UNDEFINED;
  value: undefined;
}

export type PodConsType =
  | PodType.ARGUMENTS
  | PodType.ARRAY
  | PodType.ATOM
  | PodType.CASE
  | PodType.OBJECT
  | PodType.STRING;

export interface PodEnd<T extends PodConsType = PodConsType> {
  id: number;
  pod: "end";
  type: T;
}

export interface PodProperty {
  id: number;
  pod: "cons";
  type: PodType.OBJECT;
  key: PodId | PodString;
  value: PodValue;
  next: PodId | PodProperty | PodEnd<PodType.OBJECT>;
}

export interface PodIndex {
  id: number;
  pod: "cons";
  type: PodType.ARRAY;
  value: PodValue;
  next: PodId | PodIndex | PodEnd<PodType.ARRAY>;
}

export interface PodChar {
  id: number;
  pod: "cons";
  type: PodType.STRING;
  value: PodValue;
  next: PodId | PodChar | PodEnd<PodType.STRING>;
}

export interface PodArg {
  id: number;
  pod: "cons";
  type: PodType.ARGUMENTS;
  value: PodValue;
  next: PodId | PodArg | PodEnd<PodType.ARGUMENTS>;
}

export interface PodAtom {
  id: number;
  pod: "cons";
  type: PodType.ATOM;
  callee: PodId | PodCase;
  args: PodId | PodArg | PodEnd<PodType.ARGUMENTS>;
  next: PodId | PodAtom | PodEnd<PodType.ATOM>;
}

export interface PodCase {
  id: number;
  pod: "cons";
  type: PodType.CASE;
  args: PodId | PodArg | PodEnd<PodType.ARGUMENTS>;
  body: PodId | PodAtom | PodEnd<PodType.ATOM>;
  next: PodId | PodCase | PodEnd<PodType.CASE>;
}

export function podSet(root: PodValue, path: string[], value: PodValue) {
  if (path.length === 0) {
    return value;
  }
  const [key, ...rest] = path;
  return { ...root, [key]: podSet(root[key], rest, value) };
}

export function podGet(root: PodValue, path: string[]) {
  if (path.length === 0) {
    return root;
  }
  const [key, ...rest] = path;
  return podGet(root[key], rest);
}

export function boolean(value: boolean): PodBoolean {
  return { id: -1, pod: "literal", type: PodType.BOOLEAN, value };
}

export function number(value: number): PodNumber {
  return { id: -1, pod: "literal", type: PodType.NUMBER, value };
}

export function string(value: string): PodString {
  return { id: -1, pod: "literal", type: PodType.STRING, value };
}

export function branch(
  args: PodValue[],
  body: PodAtom[] = [],
  next: PodCase | PodEnd<PodType.CASE>
): PodCase | PodEnd<PodType.CASE> {}

export function atom(
  callee: PodId | PodCase,
  _args: PodValue[],
  next: PodAtom | PodEnd<PodType.ATOM> = {
    id: -1,
    pod: "end",
    type: PodType.ATOM,
  }
): PodAtom | PodEnd<PodType.ATOM> {
  return {
    id: -1,
    pod: "cons",
    type: PodType.ATOM,
    callee,
    args: args(..._args),
    next,
  };
}

export function object(
  ...entries: [PodId | PodString, PodValue][]
): PodProperty | PodEnd<PodType.OBJECT> {
  if (entries.length > 0) {
    const [[key, value], ...rest] = entries;
    return {
      id: -1,
      pod: "cons",
      type: PodType.OBJECT,
      key,
      value,
      next: object(...rest),
    };
  }
  return { id: -1, pod: "end", type: PodType.OBJECT };
}

export function array(
  ...entries: PodValue[]
): PodIndex | PodEnd<PodType.ARRAY> {
  if (entries.length > 0) {
    const [value, ...rest] = entries;
    return {
      id: -1,
      pod: "cons",
      type: PodType.ARRAY,
      value,
      next: array(...rest),
    };
  }
  return { id: -1, pod: "end", type: PodType.ARRAY };
}

export function args(..._args: PodValue[]): PodArg | PodEnd<PodType.ARGUMENTS> {
  if (_args.length > 0) {
    const [value, ...rest] = _args;
    return {
      id: -1,
      pod: "cons",
      type: PodType.ARGUMENTS,
      value,
      next: args(...rest),
    };
  }
  return { id: -1, pod: "end", type: PodType.ARGUMENTS };
}
