import * as React from "react";
import { usePod } from "./pod-context";

import {
  PodArg,
  PodCase,
  PodChar,
  PodEnd,
  PodIndex,
  PodLiteral,
  PodNumber,
  PodProperty,
  PodString,
  PodSymbol,
  PodType,
  PodValue,
} from "./pod-editor-ast";
import { match } from "./pod-lite";

// literal =>
//   - input field
//   - change type
// cons | end =>
//   - insert item
// cons =>
//   - remove item
// id =>
//   - rename
//   - merge
//   - duplicate
export const PodChangeModal = ({
  path,
  value,
}: {
  path: string[];
  value: PodValue;
}) => {
  const { savePod, cancelChangePod } = usePod();
  return (
    <div>
      {match(
        value,
        { pod: "literal" },
        (pod: PodLiteral) => (
          <React.Fragment>
            {match(
              pod,
              { type: PodType.BOOLEAN },
              (_) => (
                <div>
                  <select>
                    <option>true</option>
                    <option>false</option>
                  </select>
                </div>
              ),
              { type: PodType.UNDEFINED },
              () => (
                <div>
                  <input disabled value="undefined" />
                </div>
              ),
              { type: PodType.OBJECT },
              () => (
                <React.Fragment>
                  <div>
                    <input disabled value="null" />
                  </div>
                  <div>
                    <button>Convert to Empty Object</button>
                    <button>Convert to Empty Array</button>
                  </div>
                </React.Fragment>
              ),
              {},
              (numberStringSymbolPod: PodNumber | PodString | PodSymbol) => (
                <div>
                  <input
                    value={match(
                      numberStringSymbolPod,
                      { type: PodType.NUMBER },
                      (numberPod: PodNumber) => numberPod.value,
                      { type: PodType.STRING },
                      (stringPod: PodString) => stringPod.value,
                      { type: PodType.SYMBOL },
                      (symbolPod: PodSymbol) => Symbol.keyFor(symbolPod.value)
                    )}
                  />
                </div>
              )
            )}
            <div>
              type:{" "}
              {match(
                pod,
                { pod: "literal" },
                (literalPod: PodLiteral) => literalPod.type
              )}
            </div>
          </React.Fragment>
        ),
        { pod: "cons" },
        (consPod: PodProperty | PodIndex | PodCase | PodChar | PodArg) =>
          match(
            value,
            { type: PodType.OBJECT },
            (_) => (
              <div>
                <button>Add Property</button>
                <button>Remove Property</button>
              </div>
            ),
            { type: PodType.ARRAY },
            () => (
              <div>
                <button>Add Index</button>
                <button>Remove Index</button>
              </div>
            ),
            { type: PodType.ARGUMENTS },
            () => (
              <div>
                <button>Add Argument</button>
                <button>Remove Argument</button>
              </div>
            ),
            { type: PodType.CASE },
            () => (
              <div>
                <button>Add Case</button>
                <button>Remove Case</button>
              </div>
            ),
            { type: PodType.ATOM },
            () => (
              <div>
                <button>Add Atom</button>
                <button>Remove Atom</button>
              </div>
            )
          ),
        { pod: "end" },
        (endPod: PodEnd) =>
          match(
            value,
            { type: PodType.OBJECT },
            (_) => (
              <div>
                <button>Add Property</button>
              </div>
            ),
            { type: PodType.ARRAY },
            () => (
              <div>
                <button>Add Index</button>
              </div>
            ),
            { type: PodType.ARGUMENTS },
            () => (
              <div>
                <button>Add Argument</button>
              </div>
            ),
            { type: PodType.CASE },
            () => (
              <div>
                <button
                  onClick={() =>
                    savePod(path, {
                      id: -1,
                      pod: "cons",
                      type: PodType.CASE,
                      args: { id: -1, pod: "end", type: PodType.ARGUMENTS },
                      body: { id: -1, pod: "end", type: PodType.ATOM },
                      next: value,
                    })
                  }
                >
                  Add Case
                </button>
              </div>
            ),
            { type: PodType.ATOM },
            () => (
              <div>
                <button>Add Atom</button>
              </div>
            )
          )
      )}
      <div>
        <button>Save</button>
        <button onClick={cancelChangePod}>Cancel</button>
      </div>
    </div>
  );
};
