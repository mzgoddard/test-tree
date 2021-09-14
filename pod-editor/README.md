# design

PodEditorRoot

```
PodValue =
  | PodId = {id, ...{}}
  | PodLiteral{T = 'boolean' | 'number' | 'string' | 'symbol' | 'undefined' | 'null'} =
    | PodId
    | {id, pod: 'literal', type: T, value: boolean | number | string | symbol | undefined | null}
  | PodCons{T, V} =
    | PodId
    | {id, pod: 'cons', type: T, ...V, next: PodCons{T, V}}
    | {id, pod: 'end', type: T}
  | PodProperty = PodCons{'object', {key: PodLiteral{'string'}, value: PodValue}}
  | PodIndex = PodCons{'array', PodValue}
  | PodArg = PodCons{'arg', PodValue}
  | PodString = PodCons{'string', PodLiteral{'string'}}
  | PodAtom = PodCons{'atom', {callee: PodId | PodCase, args: PodArg}}
  | PodCase = PodCons{'case', {args: PodArg, body: PodAtom}}
```

# PodLite

Shallow discrete object matching, remaining unkeyed properties are output.

# language

AST

## PodId

## PodLiteral

## PodCons
