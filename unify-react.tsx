import * as React from "react";

import { args, Facts, ImmutableView } from "./unify-view";

const [tag, props, children, component] = args();
const [propKey, propValue, childIndex, childValue] = args();
const [
  componentShape,
  renderedProp,
  renderedProps,
  propEntries,
  renderedPropEntries,
  child,
  renderedChild,
  renderedChildren,
  tagFunc,
  render,
] = args();

const blockId = Symbol();

class ReactView extends ImmutableView<any> {
  serialize(cycleMap = new Map()) {
    if (!cycleMap.has(this)) {
      cycleMap.set(
        this,
        React.createElement(
          this.value[0].serialize(cycleMap),
          this.value[1].serialize(cycleMap),
          this.value[2].serialize(cycleMap)
        )
      );
    }
    return cycleMap.get(this);
  }
}

const ops = [
  [
    ["_react", [tag, props, children], component],
    function* _react(goal) {
      yield* goal.context
        .get(component)
        .unify(
          new ReactView(goal.context, [
            goal.context.get(tag),
            goal.context.get(props),
            goal.context.get(children),
          ])
        );
    },
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
      ["render", ["tag-children", children], renderedChildren],
      ["_react", [tag, props, renderedChildren], component],
    ]
  )
  .add(
    ["render", ["component", tag, props, children], component],
    [
      ",",
      ["component-tag", tag, tagFunc],
      ["render", ["component-props", props], renderedProps],
      ["render", ["tag-children", children], renderedChildren],
      ["_react", [tagFunc, renderedProps, renderedChildren], component],
    ]
  )
  .add(["render", ["component-props", []], []])
  .add(
    [
      "render",
      ["component-props", [[propKey, propValue], ...props]],
      [[propKey, renderedProp], ...renderedProps],
    ],
    [
      ",",
      ["render", propValue, renderedProp],
      ["render", ["component-props", props], renderedProps],
    ]
  )
  .add(
    ["render", ["component-props", props], renderedProps],
    [
      ",",
      ["entries", props, propEntries],
      ["render", ["component-props", propEntries], renderedPropEntries],
      ["entries", renderedProps, renderedPropEntries],
    ]
  )
  .add(
    ["type", ["component", blockId, props, children]],
    [",", ["isEmptyObject", props], ["type", ["tag-children", children]]]
  );

const FactsMiddleware = React.createContext(new Facts());
const useFacts = () => React.useContext(FactsMiddleware);

function bindReactUnify(tag) {
  return function ReactUnify(props: { [key: string]: any }) {
    const facts = useFacts();
    for (const context of facts.call([
      ",",
      ["render", [tag, props], render, component],
      ["call", render],
    ])) {
      return context.get(component).serialize();
    }
  };
}
