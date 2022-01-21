import * as React from "react";

import { args, Facts } from "./unify-view";

const [tag, props, children, component] = args();
const [propKey, propValue, childIndex, childValue] = args();

const ops = [
  [
    ["_react", [tag, props, children], component],
    function* _html(goal) {
      yield* goal.context
        .get(component)
        .unify(
          React.createElement(
            goal.context.get(tag).serialize(),
            goal.context.get(props).serialize(),
            goal.context.get(children).serialize()
          )
        );
    },
  ],
  [
    ["_component", [tag, props, children], component],
    function* _component() {},
  ],
];

const facts = new Facts()
  .add(
    ["type", ["html", tag, props, children]],
    [
      ",",
      ["type", ["html-tag", tag]],
      [
        "forAll",
        ["get", props, propKey, propValue],
        ["type", ["html-prop", propKey, propValue]],
      ],
      [
        "forAll",
        ["get", children, childIndex, childValue],
        ["type", childValue],
      ],
    ]
  )
  .add(["type", ["html-tag", tag]], ["isString", tag])
  .add(["type", ["html-prop", propKey, propValue]], ["isString", propValue])
  .add(["render", component, component], ["isValue", component])
  .add(
    ["render", ["html-props", props], renderedProps],
    [
      "forEach",
      ["get", props, propKey, propValue],
      ["render", ["html-prop", propKey, propValue], renderedProps],
      renderedProps,
    ]
  )
  .add(["render", ["children", []], []])
  .add(
    [
      "render",
      ["children", [child, ...children]],
      [renderedChild, ...renderedChildren],
    ],
    ["render", child, renderedChild]
  )
  .add(
    ["render", ["html", tag, props, children], component],
    [
      ",",
      ["render", ["html-props", props], renderedProps],
      ["render", ["children", children], renderedChildren],
      ["_react", [tag, renderedProps, renderedChildren], component],
    ]
  )
  .add(
    ["render", ["component", tag, props, children], component],
    [
      ",",
      ["component-tag", tag, tagFunc],
      ["render", ["props", tag, props], renderedProps],
      ["render", ["children", children], renderedChildren],
      ["_react", [tagFunc, renderedProps, renderedChildren], component],
    ]
  )
  .add(
    ["type", ["component", [blockId, props, children]]],
    [",", ["isEmptyObject", props], ["type", ["children", children]]]
  )
  .add(
    ["type", ["children", children]],
    ["forAll", ["get", children, childIndex, childValue], ["type", childValue]]
  );

function ReactUnify({
  tag,
  children,
  facts: _facts = facts,
  ...props
}: { tag; children; facts: Facts } & { [key: string]: any }) {
  for (const context of _facts.call([
    ",",
    ["component", [tag, props, children], componentShape],
    ["render", componentShape, component],
  ])) {
    return context.get(component).serialize();
  }
}
