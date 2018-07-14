const t = require("@webassemblyjs/ast");
const { decode } = require("@webassemblyjs/wasm-parser");
const {
  encodeVersion,
  encodeHeader
} = require("@webassemblyjs/wasm-gen/lib/encoder");
const { makeBuffer } = require("@webassemblyjs/helper-buffer");
const { compareStrings } = require("@webassemblyjs/helper-test-framework");
const constants = require("@webassemblyjs/helper-wasm-bytecode");
const { numberLiteralFromRaw } = require("@webassemblyjs/node-helper");

const { addWithAST, editWithAST } = require("../lib");

const getUniqueName = t.getUniqueNameGenerator();

function ASTToString(ast) {
  const astCopy = JSON.parse(JSON.stringify(ast));

  t.traverse(astCopy, {
    NumberLiteral({ node }) {
      delete node.raw;
    },

    Identifier({ node }) {
      delete node.raw;
    },

    // wast will restore the name where wasm uses an index.
    ModuleExport({ node }) {
      node.descr.id = numberLiteralFromRaw(0);
    },

    ModuleImport({ node }) {
      node.descr.id = numberLiteralFromRaw(0);
    },

    // wasm doesn't add locations for Global nodes
    Global({ node }) {
      delete node.loc;
    },

    // Instr's loc are not updated
    Instr({ node }) {
      delete node.loc;
    }
  });

  return JSON.stringify(astCopy, null, 2);
}

function makeGlobalNode(n) {
  return t.global(t.globalType("i32", "const"), [
    t.objectInstruction("const", "i32", [numberLiteralFromRaw(n)])
  ]);
}

function removeNodesOfType(t) {
  return {
    [t](path) {
      path.remove();
    }
  };
}

function makeFuncNodes(i, params = [], results = [], body = []) {
  body.push(t.instruction("nop"));

  const id = t.identifier(getUniqueName("func"));
  const func = t.func(id, t.signature(params, results), body);

  const functype = t.typeInstruction(undefined, t.signature(params, results));

  const funcindex = t.indexInFuncSection(i);

  return [func, functype, funcindex];
}

function makeFuncExportNode(i) {
  const name = getUniqueName();

  return t.moduleExport(
    name,
    t.moduleExportDescr("Func", numberLiteralFromRaw(i))
  );
}

function makeFuncImportNode() {
  const module = getUniqueName();
  const name = getUniqueName();

  return t.moduleImport(
    module,
    name,
    t.funcImportDescr(numberLiteralFromRaw(0), t.signature([], []))
  );
}

function makeGlobalImportNode() {
  const module = getUniqueName();
  const name = getUniqueName();

  return t.moduleImport(module, name, t.globalType("i32", "const"));
}

function renameImports(name) {
  return {
    ModuleImport({ node }) {
      node.module = node.name = name;
    }
  };
}

describe("AST synchronization", () => {
  // (module)
  const bin = makeBuffer(
    encodeHeader(),
    encodeVersion(1),
    [constants.sections.type, 0x04, 0x01],
    /* 1 */ [0x60, 0x00, 0x00]
  );

  const ast = decode(bin);

  const steps = [
    b => addWithAST(ast, b, []),
    b => editWithAST(ast, b, {}),

    b => addWithAST(ast, b, [makeGlobalNode(10)]),
    b => editWithAST(ast, b, removeNodesOfType("TypeInstruction")),

    b => addWithAST(ast, b, makeFuncNodes(0)),
    b => addWithAST(ast, b, [makeFuncExportNode(0)]),

    b => addWithAST(ast, b, [makeGlobalImportNode()]),
    b => editWithAST(ast, b, renameImports("a")),
    b => editWithAST(ast, b, renameImports("b")),

    b => addWithAST(ast, b, [makeFuncImportNode()]),

    b => editWithAST(ast, b, renameImports("c"))
  ];

  it("should run steps", function() {
    if (typeof WebAssembly === "undefined") {
      console.log("WebAssembly not available, skipping");
      this.skip();
      return;
    }

    steps.reduce((acc, step) => {
      const stepBin = step(acc);

      const actualAst = ASTToString(ast);
      const expectedAst = ASTToString(decode(stepBin));

      try {
        compareStrings(actualAst, expectedAst);
      } catch (e) {
        console.error("failed at step", step.toString());
        throw e;
      }

      // check that it's still valid
      new WebAssembly.Module(stepBin);

      return stepBin;
    }, bin);
  });
});
