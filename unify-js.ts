import { args, Facts } from "./unify-view";

const [_0, _1, _2, _3, _4, _5, _6, _7, _8, _9] = args();

const facts = new Facts()
  .add(["->js", ["=", _0, _1]], [",", ["isNumber", _0], ["isArg", _1]])
  .add(
    [
      "->js",
      ["=", [], _2],
      {
        type: "if",
        condition: {
          type: "call",
          target: {
            type: "property",
            target: {
              type: "call",
              target: {
                type: "property",
                target: {
                  type: "property",
                  target: { type: "variable", name: "statement" },
                  name: "context",
                },
                name: "get",
              },
              parameters: [{ type: "arg", target: _2 }],
            },
            name: "isArg",
          },
        },
        block: null,
      },
    ],
    [",", ["isArg", _1]]
  )
  .add(
    [
      "->js",
      ["=", [_0, ..._1], _2],
      { type: "call", condition: _3, block: _4 },
    ],
    [",", ["isNumber", _0], ["isArg", _1], ["->js", _0, _3], ["->js", _1, _4]]
  )
  .add(["->js", [","]])
  .add(["->js", [",", _0, ..._1]])
  .add(["->js", [_0, ..._1]]);

interface Node {}
interface Variable {}
interface Param {}
interface Func {}
interface CallFunc {}
interface ViewNode {}
interface PropertyMember {}
interface Unify {
  left;
  right;
  block: Node[];
}
interface CallStatement {
  statement;
  block: Node[];
}
interface YieldStar {}
