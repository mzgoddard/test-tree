import * as React from "react";

import { args, Facts } from "./unify-view";

const [tag, props, children, component] = args();
const [propKey, propValue, childIndex, childValue] = args();
const [
  componentShape,
  renderedProps,
  child,
  renderedChild,
  renderedChildren,
  tagFunc,
] = args();

const blockId = Symbol();

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
      ["type", ["html-props", props]],
      ["type", ["tag-children", children]],
    ]
  )
  .add(["type", ["html-tag", tag]], ["isString", tag])
  .add(
    ["type", ["html-prop", propKey, propValue]],
    [",", ["isString", propKey], ["mayCastString", propValue]]
  )
  .add(
    ["type", ["html-props", props]],
    [
      ",",
      ["isObject", props],
      [
        "forall",
        ["get", props, propKey, propValue],
        ["type", ["html-prop", propKey, propValue]],
      ],
    ]
  )
  .add(
    ["type", ["tag-children", children]],
    [
      ",",
      ["isArray", children],
      ["forall", ["member", childValue, children], ["type", childValue]],
    ]
  )
  .add(["render", component, component], ["isLiteral", component])
  .add(
    ["render", ["html-props", props], renderedProps],
    [
      ",",
      [
        "findall",
        [propKey, renderedProp],
        [
          ",",
          ["get", props, propKey, propValue],
          ["render", ["html-prop", propKey, propValue], renderedProp],
        ],
        renderedPropEntries,
      ],
      ["entries", renderedProps, renderedPropEntries],
    ]
  )
  .add(["render", ["children", []], []])
  .add(
    [
      "render",
      ["children", [child, ...children]],
      [renderedChild, ...renderedChildren],
    ],
    [
      ",",
      ["render", child, renderedChild],
      ["render", ["children", children], renderedChildren],
    ]
  )
  .add(
    ["render", ["html", tag, props, children], component],
    [
      ",",
      ["render", ["html-props", props], renderedProps],
      ["render", ["tag-children", children], renderedChildren],
      ["_react", [tag, renderedProps, renderedChildren], component],
    ]
  )
  .add(
    ["render", ["component", tag, props, children], component],
    [
      ",",
      ["component-tag", tag, tagFunc],
      ["render", ["component-props", tag, props], renderedProps],
      ["render", ["tag-children", children], renderedChildren],
      ["_react", [tagFunc, renderedProps, renderedChildren], component],
    ]
  )
  .add(
    ["type", ["component", blockId, props, children]],
    [",", ["isEmptyObject", props], ["type", ["tag-children", children]]]
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
