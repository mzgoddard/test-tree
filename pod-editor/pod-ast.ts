type PodValue = PodId | PodLiteral<any> | PodCons<any, any>;

interface PodId {
  id: number;
}

enum PodType {
  UNDEFINED = "undefined",
  BOOLEAN = "boolean",
  SYMBOL = "symbol",
  NUMBER = "number",
  STRING = "string",
  OBJECT = "object",
  ARRAY = "array",
  ARGUMENTS = "arguments",
  ATOM = "atom",
  CASE = "case",
}

type PodLiteral<T extends PodType> =
  | PodId
  | (PodId & {
      pod: "literal";
      type: T;
      value: T extends PodType.STRING
        ? string
        : T extends PodType.NUMBER
        ? number
        : T extends PodType.BOOLEAN
        ? boolean
        : T extends PodType.SYMBOL
        ? symbol
        : T extends PodType.UNDEFINED
        ? undefined
        : T extends PodType.OBJECT
        ? null
        : never;
    });

type PodCons<T extends PodType, V extends { [key: string]: any }> =
  | PodId
  | (PodId &
      V &
      (
        | {
            pod: "cons";
            next: PodCons<T, V>;
          }
        | { pod: "end" }
      ));

type PodProperty = PodCons<
  PodType.OBJECT,
  { key: PodLiteral<PodType.STRING>; value: PodValue }
>;

type PodIndex = PodCons<PodType.ARRAY, { value: PodValue }>;

type PodChar = PodCons<PodType.STRING, { value: PodLiteral<PodType.STRING> }>;

type PodArg = PodCons<PodType.ARGUMENTS, { value: PodValue }>;

type PodAtom = PodCons<PodType.ATOM, { callee: PodCase; args: PodArg }>;

type PodCase = PodCons<PodType.CASE, { args: PodArg; body: PodAtom }>;
