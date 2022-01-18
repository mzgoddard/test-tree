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
  .add(["save", value], [",", ["type", value], ["assert", value]])
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
              ["button", [], ["save"]],
              ["button", [], ["revert"]],
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
      [
        "forEach",
        ["get", shape, key, member],
        ["view", "input", member, input],
        input,
      ],
    ]
  );
