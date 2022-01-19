import { args, Facts } from "./unify-view";

const [id, shape] = args();
const [uniqueId, testId] = args();
const [name, key, keySub, value, tests, index, uniqueTestId, _0] = args();
const [task, title, commands, assertions] = args();

const facts = new Facts()
  .add(
    ["isType", ["type", id, shape]],
    [",", ["isId", id], ["isObject", shape]]
  )
  .add(
    ["type", ["testCommand", uniqueId, { testId }]],
    [",", ["uuid", uniqueId], ["isNumber", testId]]
  )
  .add(
    ["type", ["test", uniqueId, { testId, task, title, commands, assertions }]],
    [
      ",",
      ["uuid", uniqueId],
      ["isNumber", testId],
      ["isString", task],
      ["isString", title],
      ["isArray", commands],
      ["forAll", ["get", commands, _0, value], ["isKeyChord", value]],
      ["isArray", assertions],
      ["forAll", ["get", assertions, _0, value], ["isAssertion", value]],
    ]
  )
  .add(
    ["type", ["testPlan", uniqueId, { name, key, tests }]],
    [
      ",",
      ["uuid", uniqueId],
      ["isString", name],
      ["outputOnly", key],
      ["lowerCase", name, keySub],
      ["replace", keySub, " ", "-", key],
      ["isArray", tests],
      [
        "forAll",
        ["get", tests, index, uniqueTestId],
        ["test", uniqueTestId, _0],
      ],
    ]
  )
  .add(["setPath", oldValue, [], nestedValue, nestedValue])
  .add(
    ["setPath", oldValue, [_0, ..._1], nestedValue, newValue],
    [
      ",",
      ["get", oldValue, _0, oldValueSub],
      ["setPath", oldValueSub, _1, nestedValue, newValueSub],
      ["set", oldValue, _0, newValueSub, newValue],
    ]
  )
  .add(["setting", languageId, language], ["language", language, meta])
  .add(
    ["type", ["language", uniqueId, meta]],
    [
      ",",
      ["uuid", uniqueId],
      ["get", meta, "symbol", value],
      ["isString", value],
    ]
  )
  .add(["language", englishUSID, { symbol: "enUS" }])
  .add(["save", value], [",", ["type", value], ["assert", value]])
  .add(
    ["component", caseId, [{ construct, goal }, component], component],
    [",", construct, goal]
  )
  .add(
    [
      "component",
      switchId,
      [{ construct, cases }, defaultComponent],
      component,
    ],
    [
      ";",
      [",", construct, ["get", cases, _, { goal, component }], goal],
      ["=", component, defaultComponent],
    ]
  )
  .add(["component", textId, { text }, component])
  .add(["debugName", _, "input"])
  .add(["component", _, ["field", props, children], component])
  .add(
    [
      "view",
      "edit",
      [type, id],
      [
        "block",
        [],
        [
          [
            "block",
            [],
            [
              ["text", [], [type]],
              ["text", [], [id]],
            ],
          ],
          [
            "block",
            [],
            [
              [
                "button",
                [["click", ["save", [type, id, newValue]]]],
                [["text", { default: "save" }]],
              ],
              [
                "button",
                [["click", clickRevert]],
                [["text", _, { default: "revert" }]],
              ],
            ],
          ],
          ["block", [], input],
        ],
      ],
    ],
    [
      ",",
      ["call", [type, id, value]],
      ["type", [type, id, shape]],
      ["Shape.copy", shape, value, newValue],
      [
        "forEach",
        ["get", shape, key, shapeMember],
        [
          ",",
          ["get", value, key, valueMember],
          ["get", newValue, key, newValueMember],
          ["view", "input", [shapeMember, valueMember, newValueMember], input],
        ],
        input,
      ],
      [
        "=",
        clickSave,
        [
          ",",
          [
            "forEach",
            [
              ",",
              ["get", shape, key, shapeMember],
              ["get", input, _, inputSub],
            ],
            [
              ",",
              ["view", "input", [shapeMember, _, newValueMember], inputSub],
            ],
            [key, newValueMember],
          ],
          ["entries", newValue, newValueMember],
        ],
      ],
    ]
  );
