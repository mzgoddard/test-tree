import * as React from "react";
import * as ReactDOM from "react-dom";
import { bindReactUnify, FactsMiddleware, mixinReact } from "./unify-react";
import { args, System } from "./unify-view";

const UnifyMain = bindReactUnify("main");

const UnifyExample1 = bindReactUnify("example1");

const [
  componentArg,
  exampleTag,
  propsArg,
  textArg,
  valueArg,
  typeArg,
  checkTypeArg,
  defaultArg,
] = args();

const system = new System()
  .mixin(mixinReact)
  .facts.add(["component-tag", "main", UnifyMain])
  .add(["component-tag", "example1", UnifyExample1])
  .add(["type", ["string", valueArg], ["isString", valueArg]])
  .add([
    "type",
    ["example1", propsArg],
    [",", ["get", propsArg, "text", textArg], ["isString", textArg]],
  ])
  .add(["default", valueArg, defaultArg], [";", [","]])
  .add(
    ["check-type", typeArg],
    [",", ["type", typeArg, checkTypeArg], ["call", checkTypeArg]]
  )
  .add([
    "render",
    ["main", {}],
    [
      ",",
      ["component-tag", "example1", exampleTag],
      ["_react", [exampleTag, {}, null], componentArg],
    ],
    componentArg,
  ])
  .add([
    "render",
    ["example1", {}],
    ["_react", ["div", {}, ["hello world"]], componentArg],
    componentArg,
  ]).system;

ReactDOM.render(
  <FactsMiddleware.Provider value={system.facts}>
    <UnifyMain></UnifyMain>
  </FactsMiddleware.Provider>,
  document.querySelector("div")
);
