import React from "react";

import { match } from "./pod-lite";

import * as AST from "./pod-editor-ast";
import { usePod } from "./pod-context";

export function PodEditableAST({
  value,
  parentPath: _parentPath,
  pathKey,
}: {
  value: AST.PodValue;
  parentPath: string[];
  pathKey: string;
}) {
  const { changePod } = usePod();
  const parentPath = [..._parentPath, pathKey];

  return match(
    value,
    { pod: "literal", type: AST.PodType.STRING },
    (value: AST.PodString) => (
      <span onClick={() => changePod(parentPath, value)}>"{value.value}"</span>
    ),
    { pod: "literal", type: AST.PodType.NUMBER },
    (value: AST.PodNumber) => (
      <span onClick={() => changePod(parentPath, value)}>{value.value}</span>
    ),
    { pod: "literal", type: AST.PodType.BOOLEAN },
    (value: AST.PodBoolean) => (
      <span onClick={() => changePod(parentPath, value)}>{value.value}</span>
    ),
    { pod: "literal", type: AST.PodType.OBJECT },
    (value: AST.PodNull) => (
      <span onClick={() => changePod(parentPath, value)}>null</span>
    ),
    { pod: "literal", type: AST.PodType.UNDEFINED },
    (value: AST.PodUndefined) => (
      <span onClick={() => changePod(parentPath, value)}>undefined</span>
    ),
    { pod: "literal", type: AST.PodType.SYMBOL },
    (value: AST.PodSymbol) => (
      <span onClick={() => changePod(parentPath, value)}>
        (symbol) {Symbol.keyFor(value.value)}
      </span>
    ),
    { pod: "end", type: AST.PodType.ATOM },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ATOM },
    (value: AST.PodAtom) => (
      <span onClick={() => changePod(parentPath, value)}>
        <PodEditableAST
          value={value.callee}
          parentPath={parentPath}
          pathKey={"callee"}
        />
        <span>(</span>
        <span>...</span>
        <PodEditableAST
          value={value.args}
          parentPath={parentPath}
          pathKey={"args"}
        />
        <span>)</span>
        <span>,</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
      </span>
    ),
    { pod: "end", type: AST.PodType.CASE },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>() =&gt; ()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.CASE },
    (value: AST.PodCase) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>(</span>
        <PodEditableAST
          value={value.args}
          parentPath={parentPath}
          pathKey={"args"}
        />
        <span>)</span> <span>=&gt;</span> <span>(</span>
        <PodEditableAST
          value={value.body}
          parentPath={parentPath}
          pathKey={"body"}
        />
        <span>)</span>
        <span>,</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
      </span>
    ),
    { pod: "end", type: AST.PodType.ARGUMENTS },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ARGUMENTS },
    (value: AST.PodArg) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>(</span>
        <PodEditableAST
          value={value.value}
          parentPath={parentPath}
          pathKey={"value"}
        />
        <span>,</span> <span>...</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
        <span>)</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.OBJECT },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>{"{}"}</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.OBJECT },
    (value: AST.PodProperty) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>{"{"}</span>
        <span>[</span>
        <PodEditableAST
          value={value.key}
          parentPath={parentPath}
          pathKey={"key"}
        />
        <span>]</span>
        <span>:</span>{" "}
        <PodEditableAST
          value={value.value}
          parentPath={parentPath}
          pathKey={"value"}
        />
        , <span>...</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
        <span>{"}"}</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.ARRAY },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>[]</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ARRAY },
    (value: AST.PodIndex) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>[</span>
        <PodEditableAST
          value={value.value}
          parentPath={parentPath}
          pathKey={"value"}
        />
        <span>,</span> <span>...</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
        <span>]</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.STRING },
    (value: AST.PodEnd) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>""</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.STRING },
    (value: AST.PodChar) => (
      <span onClick={() => changePod(parentPath, value)}>
        <span>"</span>
        <span>{"${"}</span>
        <PodEditableAST
          value={value.value}
          parentPath={parentPath}
          pathKey={"value"}
        />
        <span>{"}"}</span>
        <span>{"${"}</span>
        <span>...</span>
        <PodEditableAST
          value={value.next}
          parentPath={parentPath}
          pathKey={"next"}
        />
        <span>{"}"}</span>
        <span>"</span>
      </span>
    ),
    {},
    (value: AST.PodId) => (
      <span onClick={() => changePod(parentPath, value)}>#{value.id}</span>
    )
  );
}
