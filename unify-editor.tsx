import * as React from "react";

import {
  Arg,
  Facts,
  MatchMap,
  Stmt,
  View,
  ViewFactory,
  _call,
} from "./unify-view";

const MAX_ARGS = 32;
function* args() {
  for (let i = 0; i < MAX_ARGS; i++) {
    yield new Arg();
  }
  throw new Error("too many args");
}

const [component, tagName, children, _tagName] = args();

const htmlOp = [
  [
    ["_html", { tagName, children }, component],
    function* (statement, facts) {
      yield* statement.context
        .get(component)
        .unify(
          React.createElement(
            statement.context.get(tagName).serialize(),
            null,
            ...statement.context.get(children).serialize()
          )
        );
    },
  ],
  [["_settings", settings, component], function* (statement, facts) {}],
];

const basicComponents = new Facts()
  .add(
    ["html", { tagName, children }, component],
    [
      ",",
      ["is", _tagName, tagName],
      [
        "forEach",
        ["get", children, new Arg(), [type, props]],
        ["component", type, props, childComponent],
        childComponent,
      ],
      ["_html", { tagName: _tagName, children: childComponent }, component],
    ]
  )
  .add(["enum", "language", "enUS"])
  .add(["text"])
  .add(["component", "text", {}, component])
  .add(["component", "button", {}, component])
  .add(["component", "field", {}, component])
  .add(
    ["component", "block", { children }, component],
    [",", ["html", { tagName: "div", children }, component]]
  );

function ReactUnify({
  statement,
  facts,
  component,
}: {
  statement: Stmt;
  facts: Facts;
  component: Arg;
}) {
  const [unifyContext] = React.useState(() => new MatchMap());
  for (const _ of _call(ViewFactory.array(unifyContext, statement, 0), facts)) {
    return unifyContext.get(component).serialize();
  }
}

function UnifyReact({}) {}
