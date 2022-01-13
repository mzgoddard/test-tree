import * as React from "react";

import { Arg, Facts } from "./unify-view";

const MAX_ARGS = 32;
function* args() {
  for (let i = 0; i < MAX_ARGS; i++) {
    yield new Arg();
  }
  throw new Error("too many args");
}

const [component] = args();

const BASIC_COMPONENTS = new Facts()
  .add(["component", "text", {}, component])
  .add(["component", "button", {}, component])
  .add(["component", "field", {}, component]);
