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
