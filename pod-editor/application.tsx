import * as React from "react";
import { Provider, usePod } from "./pod-context";
import { PodEditableAST } from "./pod-editable-ast";
import { PodType } from "./pod-editor-ast";

function PodRoot() {
  const pod = usePod();
  const { root } = pod;
  console.log(pod);
  return <PodEditableAST value={root}></PodEditableAST>;
}

export function Application() {
  return (
    <Provider
      getModule={() => ({
        root: { id: 0, pod: "end", type: PodType.CASE },
        names: new Map(),
      })}
      save={() => {}}
    >
      <PodRoot />
    </Provider>
  );
}
