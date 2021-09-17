import React, { useState } from "react";

import { match } from "./pod-lite";

import * as AST from "./pod-editor-ast";
import { env } from "process";

export function EditableAST({ value }: { value: AST.PodValue }) {
  const { env, changePod } = useState;

  return match(
    value,
    { pod: "literal", type: AST.PodType.STRING },
    (value: AST.PodString) => (
      <span onclick={() => changePod(value)}>"{value.value}"</span>
    ),
    { pod: "literal", type: AST.PodType.NUMBER },
    (value: AST.PodNumber) => (
      <span onclick={() => changePod(value)}>{value.value}</span>
    ),
    { pod: "literal", type: AST.PodType.BOOLEAN },
    (value: AST.PodBoolean) => (
      <span onclick={() => changePod(value)}>{value.value}</span>
    ),
    { pod: "literal", type: AST.PodType.OBJECT },
    (value: AST.PodNull) => <span onclick={() => changePod(value)}>null</span>,
    { pod: "literal", type: AST.PodType.UNDEFINED },
    (value: AST.PodUndefined) => (
      <span onclick={() => changePod(value)}>undefined</span>
    ),
    { pod: "literal", type: AST.PodType.SYMBOL },
    (value: AST.PodSymbol) => (
      <span onclick={() => changePod(value)}>
        (symbol) {Symbol.keyFor(value.value)}
      </span>
    ),
    { pod: "end", type: AST.PodType.ATOM },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ATOM },
    (value: AST.PodAtom) => (
      <span onclick={() => changePod(value)}>
        <EditableAST value={value.callee} />
        <span>(</span>
        <span>...</span>
        <EditableAST value={value.args} />
        <span>)</span>
        <span>,</span>
        <EditableAST value={value.next} />
      </span>
    ),
    { pod: "end", type: AST.PodType.CASE },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>() =&gt; ()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.CASE },
    (value: AST.PodCase) => (
      <span onclick={() => changePod(value)}>
        <span>(</span>
        <EditableAST value={value.args} />
        <span>)</span> <span>=&gt;</span> <span>(</span>
        <EditableAST value={value.body} />
        <span>)</span>
        <span>,</span>
        <EditableAST value={value.next} />
      </span>
    ),
    { pod: "end", type: AST.PodType.ARGUMENTS },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>()</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ARGUMENTS },
    (value: AST.PodArg) => (
      <span onclick={() => changePod(value)}>
        <span>(</span>
        <EditableAST value={value.value} />
        <span>,</span> <span>...</span>
        <EditableAST value={value.next} />
        <span>)</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.OBJECT },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>{"{}"}</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.OBJECT },
    (value: AST.PodProperty) => (
      <span onclick={() => changePod(value)}>
        <span>{"{"}</span>
        <span>[</span>
        <EditableAST value={value.key} />
        <span>]</span>
        <span>:</span> <EditableAST value={value.value} />, <span>...</span>
        <EditableAST value={value.next} />
        <span>{"}"}</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.ARRAY },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>[]</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.ARRAY },
    (value: AST.PodIndex) => (
      <span onclick={() => changePod(value)}>
        <span>[</span>
        <EditableAST value={value.value} />
        <span>,</span> <span>...</span>
        <EditableAST value={value.next} />
        <span>]</span>
      </span>
    ),
    { pod: "end", type: AST.PodType.STRING },
    (value: AST.PodEnd) => (
      <span onclick={() => changePod(value)}>
        <span>""</span>
      </span>
    ),
    { pod: "cons", type: AST.PodType.STRING },
    (value: AST.PodChar) => (
      <span onclick={() => changePod(value)}>
        <span>"</span>
        <span>{"${"}</span>
        <EditableAST value={value.value} />
        <span>{"}"}</span>
        <span>{"${"}</span>
        <span>...</span>
        <EditableAST value={value.next} />
        <span>{"}"}</span>
        <span>"</span>
      </span>
    ),
    {},
    (value: AST.PodId) => (
      <span onclick={() => changePod(value)}>#{value.id}</span>
    )
  );
}
