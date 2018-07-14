// @flow
import { codeFrameFromSource } from "@webassemblyjs/helper-code-frame";
import { define } from "mamacro";
import { numberLiteralFromRaw } from "@webassemblyjs/node-helper";

import { parse32I } from "@webassemblyjs/node-helper/lib/number-literals";
import { parseString } from "./string-literals";

const t = require("@webassemblyjs/ast");
const { tokens, keywords } = require("./tokenizer");

declare function createUnexpectedToken(msg: string): void;

define(
  createUnexpectedToken,
  msg => `return new Error(
    "\n" +
    codeFrameFromSource(source, token.loc) + "\n"
    + ${msg} + ", given " + tokenToString(token)
  );`
);

type AllArgs = {
  args: Array<Expression>,
  namedArgs: Object
};

function hasPlugin(name: string): boolean {
  if (name !== "wast") throw new Error("unknow plugin");

  return true;
}

function isKeyword(token: Object, id: string): boolean {
  return token.type === tokens.keyword && token.value === id;
}

function tokenToString(token: Object): string {
  if (token.type === "keyword") {
    return `keyword (${token.value})`;
  }

  return token.type;
}

function identifierFromToken(token: Object): Identifier {
  const { end, start } = token.loc;
  return t.withLoc(t.identifier(token.value), end, start);
}

type ParserState = {
  registredExportedElements: Array<{
    exportType: ExportDescrType,
    name: string,
    id: Index
  }>
};

export function parse(tokensList: Array<Object>, source: string): Program {
  let current = 0;
  const getUniqueName = t.getUniqueNameGenerator();

  const state: ParserState = {
    registredExportedElements: []
  };

  // But this time we're going to use recursion instead of a `while` loop. So we
  // define a `walk` function.
  function walk(): Node {
    let token = tokensList[current];

    function eatToken() {
      token = tokensList[++current];
    }

    function getEndLoc(): Position {
      let currentToken = token;

      if (typeof currentToken === "undefined") {
        const lastToken = tokensList[tokensList.length - 1];
        currentToken = lastToken;
      }

      return currentToken.loc.end;
    }

    function getStartLoc(): Position {
      return token.loc.start;
    }

    function eatTokenOfType(type: string) {
      if (token.type !== type) {
        throw new Error(
          "\n" +
            codeFrameFromSource(source, token.loc) +
            "Assertion error: expected token of type " +
            type +
            ", given " +
            tokenToString(token)
        );
      }

      eatToken();
    }

    function parseExportIndex(token: Object): Index {
      if (token.type === tokens.identifier) {
        const index = identifierFromToken(token);
        eatToken();

        return index;
      } else if (token.type === tokens.number) {
        const index = numberLiteralFromRaw(token.value);

        eatToken();

        return index;
      } else {
        throw createUnexpectedToken("unknown export index");
      }
    }

    function lookaheadAndCheck(...tokenTypes: Array<string>): boolean {
      const len = tokenTypes.length;

      for (let i = 0; i < len; i++) {
        const tokenAhead = tokensList[current + i];
        const expectedToken = tokenTypes[i];

        if (tokenAhead.type === "keyword") {
          if (isKeyword(tokenAhead, expectedToken) === false) {
            return false;
          }
        } else if (expectedToken !== tokenAhead.type) {
          return false;
        }
      }

      return true;
    }

    // TODO(sven): there is probably a better way to do this
    // can refactor it if it get out of hands
    function maybeIgnoreComment() {
      if (typeof token === "undefined") {
        // Ignore
        return;
      }

      while (token.type === tokens.comment) {
        eatToken();

        if (typeof token === "undefined") {
          // Hit the end
          break;
        }
      }
    }

    /**
     * Parses a memory instruction
     *
     * WAST:
     *
     * memory:  ( memory <name>? <memory_sig> )
     *          ( memory <name>? ( export <string> ) <...> )
     *          ( memory <name>? ( import <string> <string> ) <memory_sig> )
     *          ( memory <name>? ( export <string> )* ( data <string>* )
     * memory_sig: <nat> <nat>?
     *
     */
    function parseMemory(): Memory {
      let id = t.identifier(getUniqueName("memory"));
      let limits = t.limit(0);

      if (token.type === tokens.string || token.type === tokens.identifier) {
        id = t.identifier(token.value);

        eatToken();
      } else {
        id = t.withRaw(id, ""); // preserve anonymous
      }

      /**
       * Maybe data
       */
      if (lookaheadAndCheck(tokens.openParen, keywords.data)) {
        eatToken(); // (
        eatToken(); // data

        // TODO(sven): do something with the data collected here
        const stringInitializer = token.value;
        eatTokenOfType(tokens.string);

        // Update limits accordingly
        limits = t.limit(stringInitializer.length);

        eatTokenOfType(tokens.closeParen);
      }

      /**
       * Maybe export
       */
      if (lookaheadAndCheck(tokens.openParen, keywords.export)) {
        eatToken(); // (
        eatToken(); // export

        if (token.type !== tokens.string) {
          throw createUnexpectedToken("Expected string in export");
        }

        const name = token.value;
        eatToken();

        state.registredExportedElements.push({
          exportType: "Memory",
          name,
          id
        });

        eatTokenOfType(tokens.closeParen);
      }

      /**
       * Memory signature
       */
      if (token.type === tokens.number) {
        limits = t.limit(parse32I(token.value));
        eatToken();

        if (token.type === tokens.number) {
          limits.max = parse32I(token.value);
          eatToken();
        }
      }

      return t.memory(limits, id);
    }

    /**
     * Parses a data section
     * https://webassembly.github.io/spec/core/text/modules.html#data-segments
     *
     * WAST:
     *
     * data:  ( data <index>? <offset> <string> )
     */
    function parseData(): Data {
      // optional memory index
      let memidx = 0;
      if (token.type === tokens.number) {
        memidx = token.value;
        eatTokenOfType(tokens.number); // .
      }

      eatTokenOfType(tokens.openParen);

      let offset: Instruction;
      if (token.type === tokens.valtype) {
        eatTokenOfType(tokens.valtype); // i32
        eatTokenOfType(tokens.dot); // .

        if (token.value !== "const") {
          throw new Error("constant expression required");
        }
        eatTokenOfType(tokens.name); // const

        const numberLiteral = numberLiteralFromRaw(token.value, "i32");
        offset = t.objectInstruction("const", "i32", [numberLiteral]);
        eatToken();

        eatTokenOfType(tokens.closeParen);
      } else {
        eatTokenOfType(tokens.name); // get_global

        const numberLiteral = numberLiteralFromRaw(token.value, "i32");
        offset = t.instruction("get_global", [numberLiteral]);
        eatToken();

        eatTokenOfType(tokens.closeParen);
      }

      const byteArray = parseString(token.value);
      eatToken(); // "string"

      return t.data(t.memIndexLiteral(memidx), offset, t.byteArray(byteArray));
    }

    /**
     * Parses a table instruction
     *
     * WAST:
     *
     * table:   ( table <name>? <table_type> )
     *          ( table <name>? ( export <string> ) <...> )
     *          ( table <name>? ( import <string> <string> ) <table_type> )
     *          ( table <name>? ( export <string> )* <elem_type> ( elem <var>* ) )
     *
     * table_type:  <nat> <nat>? <elem_type>
     * elem_type: anyfunc
     *
     * elem:    ( elem <var>? (offset <instr>* ) <var>* )
     *          ( elem <var>? <expr> <var>* )
     */
    function parseTable(): Table {
      let name = t.identifier(getUniqueName("table"));

      let limit = t.limit(0);
      const elemIndices = [];
      const elemType = "anyfunc";

      if (token.type === tokens.string || token.type === tokens.identifier) {
        name = identifierFromToken(token);
        eatToken();
      } else {
        name = t.withRaw(name, ""); // preserve anonymous
      }

      while (token.type !== tokens.closeParen) {
        /**
         * Maybe export
         */
        if (lookaheadAndCheck(tokens.openParen, keywords.elem)) {
          eatToken(); // (
          eatToken(); // elem

          while (token.type === tokens.identifier) {
            elemIndices.push(t.identifier(token.value));
            eatToken();
          }

          eatTokenOfType(tokens.closeParen);
        } else if (lookaheadAndCheck(tokens.openParen, keywords.export)) {
          eatToken(); // (
          eatToken(); // export

          if (token.type !== tokens.string) {
            throw createUnexpectedToken("Expected string in export");
          }

          const exportName = token.value;
          eatToken();

          state.registredExportedElements.push({
            exportType: "Table",
            name: exportName,
            id: name
          });

          eatTokenOfType(tokens.closeParen);
        } else if (isKeyword(token, keywords.anyfunc)) {
          // It's the default value, we can ignore it
          eatToken(); // anyfunc
        } else if (token.type === tokens.number) {
          /**
           * Table type
           */
          const min = parseInt(token.value);
          eatToken();

          if (token.type === tokens.number) {
            const max = parseInt(token.value);
            eatToken();

            limit = t.limit(min, max);
          } else {
            limit = t.limit(min);
          }

          eatToken();
        } else {
          throw createUnexpectedToken("Unexpected token");
        }
      }

      if (elemIndices.length > 0) {
        return t.table(elemType, limit, name, elemIndices);
      } else {
        return t.table(elemType, limit, name);
      }
    }

    /**
     * Parses an import statement
     *
     * WAST:
     *
     * import:  ( import <string> <string> <imkind> )
     * imkind:  ( func <name>? <func_sig> )
     *          ( global <name>? <global_sig> )
     *          ( table <name>? <table_sig> )
     *          ( memory <name>? <memory_sig> )
     *
     * global_sig: <type> | ( mut <type> )
     */
    function parseImport(): ModuleImport {
      if (token.type !== tokens.string) {
        throw new Error("Expected a string, " + token.type + " given.");
      }

      const moduleName = token.value;
      eatToken();

      if (token.type !== tokens.string) {
        throw new Error("Expected a string, " + token.type + " given.");
      }

      const name = token.value;

      let fnName = t.identifier(`${moduleName}.${name}`);
      eatToken();

      eatTokenOfType(tokens.openParen);

      let descr;

      if (isKeyword(token, keywords.func)) {
        eatToken(); // keyword

        const fnParams = [];
        const fnResult = [];

        if (token.type === tokens.identifier) {
          fnName = identifierFromToken(token);
          eatToken();
        }

        while (token.type === tokens.openParen) {
          eatToken();

          if (lookaheadAndCheck(keywords.param) === true) {
            eatToken();

            fnParams.push(...parseFuncParam());
          } else if (lookaheadAndCheck(keywords.result) === true) {
            eatToken();

            fnResult.push(...parseFuncResult());
          } else {
            throw createUnexpectedToken("Unexpected token in import of type");
          }

          eatTokenOfType(tokens.closeParen);
        }

        if (typeof fnName === "undefined") {
          throw new Error("Imported function must have a name");
        }

        descr = t.funcImportDescr(fnName, t.signature(fnParams, fnResult));
      } else if (isKeyword(token, keywords.global)) {
        eatToken(); // keyword

        if (token.type === tokens.openParen) {
          eatToken(); // (
          eatTokenOfType(tokens.keyword); // mut keyword

          const valtype = token.value;
          eatToken();

          descr = t.globalType(valtype, "var");

          eatTokenOfType(tokens.closeParen);
        } else {
          const valtype = token.value;
          eatTokenOfType(tokens.valtype);

          descr = t.globalType(valtype, "const");
        }
      } else if (isKeyword(token, keywords.memory) === true) {
        eatToken(); // Keyword

        descr = parseMemory();
      } else if (isKeyword(token, keywords.table) === true) {
        eatToken(); // Keyword

        descr = parseTable();
      } else {
        throw new Error("Unsupported import type: " + tokenToString(token));
      }

      eatTokenOfType(tokens.closeParen);

      return t.moduleImport(moduleName, name, descr);
    }

    /**
     * Parses a block instruction
     *
     * WAST:
     *
     * expr: ( block <name>? <block_sig> <instr>* )
     * instr: block <name>? <block_sig> <instr>* end <name>?
     * block_sig : ( result <type>* )*
     *
     */
    function parseBlock(): BlockInstruction {
      let label = t.identifier(getUniqueName("block"));
      let blockResult = null;
      const instr = [];

      if (token.type === tokens.identifier) {
        label = identifierFromToken(token);
        eatToken();
      } else {
        label = t.withRaw(label, ""); // preserve anonymous
      }

      while (token.type === tokens.openParen) {
        eatToken();

        if (lookaheadAndCheck(keywords.result) === true) {
          eatToken();

          blockResult = token.value;
          eatToken();
        } else if (
          lookaheadAndCheck(tokens.name) === true ||
          lookaheadAndCheck(tokens.valtype) === true ||
          token.type === "keyword" // is any keyword
        ) {
          // Instruction
          instr.push(parseFuncInstr());
        } else {
          throw createUnexpectedToken("Unexpected token in block body of type");
        }

        maybeIgnoreComment();

        eatTokenOfType(tokens.closeParen);
      }

      return t.blockInstruction(label, instr, blockResult);
    }

    /**
     * Parses a if instruction
     *
     * WAST:
     *
     * expr:
     * ( if <name>? <block_sig> ( then <instr>* ) ( else <instr>* )? )
     * ( if <name>? <block_sig> <expr>+ ( then <instr>* ) ( else <instr>* )? )
     *
     * instr:
     * if <name>? <block_sig> <instr>* end <name>?
     * if <name>? <block_sig> <instr>* else <name>? <instr>* end <name>?
     *
     * block_sig : ( result <type>* )*
     *
     */
    function parseIf(): IfInstruction {
      let blockResult = null;
      let label = t.identifier(getUniqueName("if"));

      const testInstrs = [];
      const consequent = [];
      const alternate = [];

      if (token.type === tokens.identifier) {
        label = identifierFromToken(token);
        eatToken();
      } else {
        label = t.withRaw(label, ""); // preserve anonymous
      }

      while (token.type === tokens.openParen) {
        eatToken(); // (

        /**
         * Block signature
         */
        if (isKeyword(token, keywords.result) === true) {
          eatToken();

          blockResult = token.value;
          eatTokenOfType(tokens.valtype);

          eatTokenOfType(tokens.closeParen);

          continue;
        }

        /**
         * Then
         */
        if (isKeyword(token, keywords.then) === true) {
          eatToken(); // then

          while (token.type === tokens.openParen) {
            eatToken();

            // Instruction
            if (
              lookaheadAndCheck(tokens.name) === true ||
              lookaheadAndCheck(tokens.valtype) === true ||
              token.type === "keyword" // is any keyword
            ) {
              consequent.push(parseFuncInstr());
            } else {
              throw createUnexpectedToken(
                "Unexpected token in consequent body of type"
              );
            }

            eatTokenOfType(tokens.closeParen);
          }

          eatTokenOfType(tokens.closeParen);

          continue;
        }

        /**
         * Alternate
         */
        if (isKeyword(token, keywords.else)) {
          eatToken(); // else

          while (token.type === tokens.openParen) {
            eatToken();

            // Instruction
            if (
              lookaheadAndCheck(tokens.name) === true ||
              lookaheadAndCheck(tokens.valtype) === true ||
              token.type === "keyword" // is any keyword
            ) {
              alternate.push(parseFuncInstr());
            } else {
              throw createUnexpectedToken(
                "Unexpected token in alternate body of type"
              );
            }

            eatTokenOfType(tokens.closeParen);
          }

          eatTokenOfType(tokens.closeParen);

          continue;
        }

        /**
         * Test instruction
         */
        if (
          lookaheadAndCheck(tokens.name) === true ||
          lookaheadAndCheck(tokens.valtype) === true ||
          token.type === "keyword" // is any keyword
        ) {
          testInstrs.push(parseFuncInstr());

          eatTokenOfType(tokens.closeParen);

          continue;
        }

        throw createUnexpectedToken("Unexpected token in if body");
      }

      return t.ifInstruction(
        label,
        testInstrs,
        blockResult,
        consequent,
        alternate
      );
    }

    /**
     * Parses a loop instruction
     *
     * WAT:
     *
     * blockinstr :: 'loop' I:label rt:resulttype (in:instr*) 'end' id?
     *
     * WAST:
     *
     * instr     :: loop <name>? <block_sig> <instr>* end <name>?
     * expr      :: ( loop <name>? <block_sig> <instr>* )
     * block_sig :: ( result <type>* )*
     *
     */
    function parseLoop(): LoopInstruction {
      let label = t.identifier(getUniqueName("loop"));
      let blockResult;
      const instr = [];

      if (token.type === tokens.identifier) {
        label = identifierFromToken(token);
        eatToken();
      } else {
        label = t.withRaw(label, ""); // preserve anonymous
      }

      while (token.type === tokens.openParen) {
        eatToken();

        if (lookaheadAndCheck(keywords.result) === true) {
          eatToken();

          blockResult = token.value;
          eatToken();
        } else if (
          lookaheadAndCheck(tokens.name) === true ||
          lookaheadAndCheck(tokens.valtype) === true ||
          token.type === "keyword" // is any keyword
        ) {
          // Instruction
          instr.push(parseFuncInstr());
        } else {
          throw createUnexpectedToken("Unexpected token in loop body");
        }

        eatTokenOfType(tokens.closeParen);
      }

      return t.loopInstruction(label, blockResult, instr);
    }

    function parseCallIndirect(): CallIndirectInstruction {
      let typeRef;
      const params = [];
      const results = [];
      const instrs = [];

      while (token.type !== tokens.closeParen) {
        if (lookaheadAndCheck(tokens.openParen, keywords.type)) {
          eatToken(); // (
          eatToken(); // type
          typeRef = parseTypeReference();
        } else if (lookaheadAndCheck(tokens.openParen, keywords.param)) {
          eatToken(); // (
          eatToken(); // param

          /**
           * Params can be empty:
           * (params)`
           */
          if (token.type !== tokens.closeParen) {
            params.push(...parseFuncParam());
          }
        } else if (lookaheadAndCheck(tokens.openParen, keywords.result)) {
          eatToken(); // (
          eatToken(); // result

          /**
           * Results can be empty:
           * (result)`
           */
          if (token.type !== tokens.closeParen) {
            results.push(...parseFuncResult());
          }
        } else {
          eatTokenOfType(tokens.openParen);

          instrs.push(parseFuncInstr());
        }

        eatTokenOfType(tokens.closeParen);
      }

      return t.callIndirectInstruction(
        typeRef !== undefined ? typeRef : t.signature(params, results),
        instrs
      );
    }

    /**
     * Parses an export instruction
     *
     * WAT:
     *
     * export:  ( export <string> <exkind> )
     * exkind:  ( func <var> )
     *          ( global <var> )
     *          ( table <var> )
     *          ( memory <var> )
     * var:    <nat> | <name>
     *
     */
    function parseExport(): ModuleExport {
      if (token.type !== tokens.string) {
        throw new Error("Expected string after export, got: " + token.type);
      }

      const name = token.value;
      eatToken();

      const moduleExportDescr = parseModuleExportDescr();

      return t.moduleExport(name, moduleExportDescr);
    }

    function parseModuleExportDescr(): ModuleExportDescr {
      const startLoc = getStartLoc();

      let type = "";
      let index;

      eatTokenOfType(tokens.openParen);

      while (token.type !== tokens.closeParen) {
        if (isKeyword(token, keywords.func)) {
          type = "Func";
          eatToken();
          index = parseExportIndex(token);
        } else if (isKeyword(token, keywords.table)) {
          type = "Table";
          eatToken();
          index = parseExportIndex(token);
        } else if (isKeyword(token, keywords.global)) {
          type = "Global";
          eatToken();
          index = parseExportIndex(token);
        } else if (isKeyword(token, keywords.memory)) {
          type = "Memory";
          eatToken();
          index = parseExportIndex(token);
        }

        eatToken();
      }

      if (type === "") {
        throw new Error("Unknown export type");
      }

      if (index === undefined) {
        throw new Error("Exported function must have a name");
      }

      const node = t.moduleExportDescr(type, index);
      const endLoc = getEndLoc();

      eatTokenOfType(tokens.closeParen);

      return t.withLoc(node, endLoc, startLoc);
    }

    function parseModule(): Module {
      let name = null;
      let isBinary = false;
      let isQuote = false;
      const moduleFields = [];

      if (token.type === tokens.identifier) {
        name = token.value;
        eatToken();
      }

      if (
        hasPlugin("wast") &&
        token.type === tokens.name &&
        token.value === "binary"
      ) {
        eatToken();

        isBinary = true;
      }

      if (
        hasPlugin("wast") &&
        token.type === tokens.name &&
        token.value === "quote"
      ) {
        eatToken();

        isQuote = true;
      }

      if (isBinary === true) {
        const blob = [];

        while (token.type === tokens.string) {
          blob.push(token.value);
          eatToken();

          maybeIgnoreComment();
        }

        eatTokenOfType(tokens.closeParen);

        return t.binaryModule(name, blob);
      }

      if (isQuote === true) {
        const string = [];

        while (token.type === tokens.string) {
          string.push(token.value);
          eatToken();
        }

        eatTokenOfType(tokens.closeParen);

        return t.quoteModule(name, string);
      }

      while (token.type !== tokens.closeParen) {
        moduleFields.push(walk());

        if (state.registredExportedElements.length > 0) {
          state.registredExportedElements.forEach(decl => {
            moduleFields.push(
              t.moduleExport(
                decl.name,
                t.moduleExportDescr(decl.exportType, decl.id)
              )
            );
          });

          state.registredExportedElements = [];
        }

        token = tokensList[current];
      }

      eatTokenOfType(tokens.closeParen);

      return t.module(name, moduleFields);
    }

    /**
     * Parses the arguments of an instruction
     */
    function parseFuncInstrArguments(signature: ?SignatureMap): AllArgs {
      const args: Array<Expression> = [];
      const namedArgs = {};
      let signaturePtr = 0;

      while (token.type === tokens.name || isKeyword(token, keywords.offset)) {
        const key = token.value;
        eatToken();

        eatTokenOfType(tokens.equal);

        let value: any;

        if (token.type === tokens.number) {
          value = numberLiteralFromRaw(token.value);
        } else {
          throw new Error("Unexpected type for argument: " + token.type);
        }

        namedArgs[key] = value;

        eatToken();
      }

      // $FlowIgnore
      const signatureLength = signature.vector ? Infinity : signature.length;

      while (
        token.type !== tokens.closeParen &&
        // $FlowIgnore
        (token.type === tokens.openParen || signaturePtr < signatureLength)
      ) {
        if (token.type === tokens.identifier) {
          args.push(t.identifier(token.value));

          eatToken();
        } else if (token.type === tokens.valtype) {
          // Handle locals
          args.push(t.valtypeLiteral(token.value));

          eatToken();
        } else if (token.type === tokens.string) {
          args.push(t.stringLiteral(token.value));

          eatToken();
        } else if (token.type === tokens.number) {
          args.push(
            // TODO(sven): refactor the type signature handling
            // https://github.com/xtuc/webassemblyjs/pull/129 is a good start
            numberLiteralFromRaw(
              token.value,
              // $FlowIgnore
              signature[signaturePtr] || "f64"
            )
          );

          // $FlowIgnore
          if (!signature.vector) {
            ++signaturePtr;
          }

          eatToken();
        } else if (token.type === tokens.openParen) {
          /**
           * Maybe some nested instructions
           */
          eatToken();

          // Instruction
          if (
            lookaheadAndCheck(tokens.name) === true ||
            lookaheadAndCheck(tokens.valtype) === true ||
            token.type === "keyword" // is any keyword
          ) {
            // $FlowIgnore
            args.push(parseFuncInstr());
          } else {
            throw createUnexpectedToken(
              "Unexpected token in nested instruction"
            );
          }

          if (token.type === tokens.closeParen) {
            eatToken();
          }
        } else {
          throw createUnexpectedToken(
            "Unexpected token in instruction argument"
          );
        }
      }

      return { args, namedArgs };
    }

    /**
     * Parses an instruction
     *
     * WAT:
     *
     * instr      :: plaininst
     *               blockinstr
     *
     * blockinstr :: 'block' I:label rt:resulttype (in:instr*) 'end' id?
     *               'loop' I:label rt:resulttype (in:instr*) 'end' id?
     *               'if' I:label rt:resulttype (in:instr*) 'else' id? (in2:intr*) 'end' id?
     *
     * plaininst  :: 'unreachable'
     *               'nop'
     *               'br' l:labelidx
     *               'br_if' l:labelidx
     *               'br_table' l*:vec(labelidx) ln:labelidx
     *               'return'
     *               'call' x:funcidx
     *               'call_indirect' x, I:typeuse
     *
     * WAST:
     *
     * instr:
     *   <expr>
     *   <op>
     *   block <name>? <block_sig> <instr>* end <name>?
     *   loop <name>? <block_sig> <instr>* end <name>?
     *   if <name>? <block_sig> <instr>* end <name>?
     *   if <name>? <block_sig> <instr>* else <name>? <instr>* end <name>?
     *
     * expr:
     *   ( <op> )
     *   ( <op> <expr>+ )
     *   ( block <name>? <block_sig> <instr>* )
     *   ( loop <name>? <block_sig> <instr>* )
     *   ( if <name>? <block_sig> ( then <instr>* ) ( else <instr>* )? )
     *   ( if <name>? <block_sig> <expr>+ ( then <instr>* ) ( else <instr>* )? )
     *
     * op:
     *   unreachable
     *   nop
     *   br <var>
     *   br_if <var>
     *   br_table <var>+
     *   return
     *   call <var>
     *   call_indirect <func_sig>
     *   drop
     *   select
     *   get_local <var>
     *   set_local <var>
     *   tee_local <var>
     *   get_global <var>
     *   set_global <var>
     *   <type>.load((8|16|32)_<sign>)? <offset>? <align>?
     *   <type>.store(8|16|32)? <offset>? <align>?
     *   current_memory
     *   grow_memory
     *   <type>.const <value>
     *   <type>.<unop>
     *   <type>.<binop>
     *   <type>.<testop>
     *   <type>.<relop>
     *   <type>.<cvtop>/<type>
     *
     * func_type:   ( type <var> )? <param>* <result>*
     */
    function parseFuncInstr(): Instruction {
      const startLoc = getStartLoc();

      maybeIgnoreComment();

      /**
       * A simple instruction
       */
      if (token.type === tokens.name || token.type === tokens.valtype) {
        let name = token.value;
        let object;

        eatToken();

        if (token.type === tokens.dot) {
          object = name;
          eatToken();

          if (token.type !== tokens.name) {
            throw new TypeError(
              "Unknown token: " + token.type + ", name expected"
            );
          }

          name = token.value;
          eatToken();
        }

        if (token.type === tokens.closeParen) {
          const endLoc = token.loc.end;

          if (typeof object === "undefined") {
            return t.withLoc(t.instruction(name), endLoc, startLoc);
          } else {
            return t.withLoc(
              t.objectInstruction(name, object, []),
              endLoc,
              startLoc
            );
          }
        }

        const signature = t.signatureForOpcode(object || "", name);

        const { args, namedArgs } = parseFuncInstrArguments(signature);

        const endLoc = token.loc.end;

        if (typeof object === "undefined") {
          return t.withLoc(
            t.instruction(name, args, namedArgs),
            endLoc,
            startLoc
          );
        } else {
          return t.withLoc(
            t.objectInstruction(name, object, args, namedArgs),
            endLoc,
            startLoc
          );
        }
      } else if (isKeyword(token, keywords.loop)) {
        /**
         * Else a instruction with a keyword (loop or block)
         */
        eatToken(); // keyword

        return parseLoop();
      } else if (isKeyword(token, keywords.block)) {
        eatToken(); // keyword

        return parseBlock();
      } else if (isKeyword(token, keywords.call_indirect)) {
        eatToken(); // keyword
        return parseCallIndirect();
      } else if (isKeyword(token, keywords.call)) {
        eatToken(); // keyword

        let index;

        if (token.type === tokens.identifier) {
          index = identifierFromToken(token);
          eatToken();
        } else if (token.type === tokens.number) {
          index = t.indexLiteral(token.value);
          eatToken();
        }

        const instrArgs = [];

        // Nested instruction
        while (token.type === tokens.openParen) {
          eatToken();

          instrArgs.push(parseFuncInstr());
          eatTokenOfType(tokens.closeParen);
        }

        if (typeof index === "undefined") {
          throw new Error("Missing argument in call instruciton");
        }

        if (instrArgs.length > 0) {
          return t.callInstruction(index, instrArgs);
        } else {
          return t.callInstruction(index);
        }
      } else if (isKeyword(token, keywords.if)) {
        eatToken(); // Keyword

        return parseIf();
      } else if (isKeyword(token, keywords.module) && hasPlugin("wast")) {
        eatToken();

        // In WAST you can have a module as an instruction's argument
        // we will cast it into a instruction to not break the flow
        // $FlowIgnore
        const module: Instruction = parseModule();

        return module;
      } else {
        throw createUnexpectedToken("Unexpected instruction in function body");
      }
    }

    /*
     * Parses a function
     *
     * WAT:
     *
     * functype :: ( 'func' t1:vec(param) t2:vec(result) )
     * param    :: ( 'param' id? t:valtype )
     * result   :: ( 'result' t:valtype )
     *
     * WAST:
     *
     * func     :: ( func <name>? <func_sig> <local>* <instr>* )
     *             ( func <name>? ( export <string> ) <...> )
     *             ( func <name>? ( import <string> <string> ) <func_sig> )
     * func_sig :: ( type <var> )? <param>* <result>*
     * param    :: ( param <type>* ) | ( param <name> <type> )
     * result   :: ( result <type>* )
     * local    :: ( local <type>* ) | ( local <name> <type> )
     *
     */
    function parseFunc(): Func {
      let fnName = t.identifier(getUniqueName("func"));
      let typeRef;
      const fnBody = [];
      const fnParams: Array<FuncParam> = [];
      const fnResult: Array<Valtype> = [];

      // name
      if (token.type === tokens.identifier) {
        fnName = identifierFromToken(token);
        eatToken();
      } else {
        fnName = t.withRaw(fnName, ""); // preserve anonymous
      }

      maybeIgnoreComment();

      while (
        token.type === tokens.openParen ||
        token.type === tokens.name ||
        token.type === tokens.valtype
      ) {
        // Instructions without parens
        if (token.type === tokens.name || token.type === tokens.valtype) {
          fnBody.push(parseFuncInstr());
          continue;
        }

        eatToken();

        if (lookaheadAndCheck(keywords.param) === true) {
          eatToken();

          fnParams.push(...parseFuncParam());
        } else if (lookaheadAndCheck(keywords.result) === true) {
          eatToken();

          fnResult.push(...parseFuncResult());
        } else if (lookaheadAndCheck(keywords.export) === true) {
          eatToken();
          parseFuncExport(fnName);
        } else if (lookaheadAndCheck(keywords.type) === true) {
          eatToken();
          typeRef = parseTypeReference();
        } else if (
          lookaheadAndCheck(tokens.name) === true ||
          lookaheadAndCheck(tokens.valtype) === true ||
          token.type === "keyword" // is any keyword
        ) {
          // Instruction
          fnBody.push(parseFuncInstr());
        } else {
          throw createUnexpectedToken("Unexpected token in func body");
        }

        eatTokenOfType(tokens.closeParen);
      }

      return t.func(
        fnName,
        typeRef !== undefined ? typeRef : t.signature(fnParams, fnResult),
        fnBody
      );
    }

    /**
     * Parses shorthand export in func
     *
     * export :: ( export <string> )
     */
    function parseFuncExport(funcId: Identifier) {
      if (token.type !== tokens.string) {
        throw createUnexpectedToken("Function export expected a string");
      }

      const name = token.value;
      eatToken();

      /**
       * Func export shorthand, we trait it as a syntaxic sugar.
       * A export ModuleField will be added later.
       *
       * We give the anonymous function a generated name and export it.
       */
      const id = t.identifier(funcId.value);

      state.registredExportedElements.push({
        exportType: "Func",
        name,
        id
      });
    }

    /**
     * Parses a type instruction
     *
     * WAST:
     *
     * typedef: ( type <name>? ( func <param>* <result>* ) )
     */
    function parseType(): TypeInstruction {
      let id;
      let params = [];
      let result = [];

      if (token.type === tokens.identifier) {
        id = identifierFromToken(token);
        eatToken();
      }

      if (lookaheadAndCheck(tokens.openParen, keywords.func)) {
        eatToken(); // (
        eatToken(); // func

        if (token.type === tokens.closeParen) {
          eatToken();
          // function with an empty signature, we can abort here
          return t.typeInstruction(id, t.signature([], []));
        }

        if (lookaheadAndCheck(tokens.openParen, keywords.param)) {
          eatToken(); // (
          eatToken(); // param

          params = parseFuncParam();

          eatTokenOfType(tokens.closeParen);
        }

        if (lookaheadAndCheck(tokens.openParen, keywords.result)) {
          eatToken(); // (
          eatToken(); // result

          result = parseFuncResult();

          eatTokenOfType(tokens.closeParen);
        }

        eatTokenOfType(tokens.closeParen);
      }

      return t.typeInstruction(id, t.signature(params, result));
    }

    /**
     * Parses a function result
     *
     * WAST:
     *
     * result :: ( result <type>* )
     */
    function parseFuncResult(): Array<Valtype> {
      const results = [];

      while (token.type !== tokens.closeParen) {
        if (token.type !== tokens.valtype) {
          throw createUnexpectedToken("Unexpected token in func result");
        }

        const valtype = token.value;
        eatToken();

        results.push(valtype);
      }
      return results;
    }

    /**
     * Parses a type reference
     *
     */
    function parseTypeReference() {
      let ref;
      if (token.type === tokens.identifier) {
        ref = identifierFromToken(token);
        eatToken();
      } else if (token.type === tokens.number) {
        ref = numberLiteralFromRaw(token.value);
        eatToken();
      }
      return ref;
    }

    /**
     * Parses a global instruction
     *
     * WAST:
     *
     * global:  ( global <name>? <global_sig> <instr>* )
     *          ( global <name>? ( export <string> ) <...> )
     *          ( global <name>? ( import <string> <string> ) <global_sig> )
     *
     * global_sig: <type> | ( mut <type> )
     *
     */
    function parseGlobal(): Global {
      let name = t.identifier(getUniqueName("global"));
      let type;

      // Keep informations in case of a shorthand import
      let importing = null;

      maybeIgnoreComment();

      if (token.type === tokens.identifier) {
        name = identifierFromToken(token);
        eatToken();
      } else {
        name = t.withRaw(name, ""); // preserve anonymous
      }

      /**
       * maybe export
       */
      if (lookaheadAndCheck(tokens.openParen, keywords.export)) {
        eatToken(); // (
        eatToken(); // export

        const exportName = token.value;
        eatTokenOfType(tokens.string);

        state.registredExportedElements.push({
          exportType: "Global",
          name: exportName,
          id: name
        });

        eatTokenOfType(tokens.closeParen);
      }

      /**
       * maybe import
       */
      if (lookaheadAndCheck(tokens.openParen, keywords.import)) {
        eatToken(); // (
        eatToken(); // import

        const moduleName = token.value;
        eatTokenOfType(tokens.string);

        const name = token.value;
        eatTokenOfType(tokens.string);

        importing = {
          module: moduleName,
          name,
          descr: undefined
        };

        eatTokenOfType(tokens.closeParen);
      }

      /**
       * global_sig
       */
      if (token.type === tokens.valtype) {
        type = t.globalType(token.value, "const");
        eatToken();
      } else if (token.type === tokens.openParen) {
        eatToken(); // (

        if (isKeyword(token, keywords.mut) === false) {
          throw createUnexpectedToken("Unsupported global type, expected mut");
        }

        eatToken(); // mut

        type = t.globalType(token.value, "var");
        eatToken();

        eatTokenOfType(tokens.closeParen);
      }

      if (type === undefined) {
        throw createUnexpectedToken("Could not determine global type");
      }

      maybeIgnoreComment();

      const init = [];

      if (importing != null) {
        importing.descr = type;
        init.push(
          t.moduleImport(importing.module, importing.name, importing.descr)
        );
      }

      /**
       * instr*
       */
      while (token.type === tokens.openParen) {
        eatToken();

        init.push(parseFuncInstr());
        eatTokenOfType(tokens.closeParen);
      }

      return t.global(type, init, name);
    }

    /**
     * Parses a function param
     *
     * WAST:
     *
     * param    :: ( param <type>* ) | ( param <name> <type> )
     */
    function parseFuncParam(): Array<FuncParam> {
      const params: Array<FuncParam> = [];
      let id;
      let valtype;

      if (token.type === tokens.identifier) {
        id = token.value;
        eatToken();
      }

      if (token.type === tokens.valtype) {
        valtype = token.value;
        eatToken();

        params.push({
          id,
          valtype
        });

        /**
         * Shorthand notation for multiple anonymous parameters
         * @see https://webassembly.github.io/spec/core/text/types.html#function-types
         * @see https://github.com/xtuc/webassemblyjs/issues/6
         */
        if (id === undefined) {
          while (token.type === tokens.valtype) {
            valtype = token.value;
            eatToken();

            params.push({
              id: undefined,
              valtype
            });
          }
        }
      } else {
        // ignore
      }

      return params;
    }

    /**
     * Parses an element segments instruction
     *
     * WAST:
     *
     * elem:    ( elem <var>? (offset <instr>* ) <var>* )
     *          ( elem <var>? <expr> <var>* )
     *
     * var:    <nat> | <name>
     */
    function parseElem(): Elem {
      let tableIndex = t.indexLiteral(0);

      const offset = [];
      const funcs = [];

      if (token.type === tokens.identifier) {
        tableIndex = identifierFromToken(token);
        eatToken();
      }

      if (token.type === tokens.number) {
        tableIndex = t.indexLiteral(token.value);
        eatToken();
      }

      while (token.type !== tokens.closeParen) {
        if (lookaheadAndCheck(tokens.openParen, keywords.offset)) {
          eatToken(); // (
          eatToken(); // offset

          while (token.type !== tokens.closeParen) {
            eatTokenOfType(tokens.openParen);

            offset.push(parseFuncInstr());

            eatTokenOfType(tokens.closeParen);
          }

          eatTokenOfType(tokens.closeParen);
        } else if (token.type === tokens.identifier) {
          funcs.push(t.identifier(token.value));
          eatToken();
        } else if (token.type === tokens.number) {
          funcs.push(t.indexLiteral(token.value));
          eatToken();
        } else if (token.type === tokens.openParen) {
          eatToken(); // (

          offset.push(parseFuncInstr());

          eatTokenOfType(tokens.closeParen);
        } else {
          throw createUnexpectedToken("Unsupported token in elem");
        }
      }

      return t.elem(tableIndex, offset, funcs);
    }

    /**
     * Parses the start instruction in a module
     *
     * WAST:
     *
     * start:   ( start <var> )
     * var:    <nat> | <name>
     *
     * WAT:
     * start ::= ‘(’ ‘start’  x:funcidx ‘)’
     */
    function parseStart(): Start {
      if (token.type === tokens.identifier) {
        const index = identifierFromToken(token);
        eatToken();

        return t.start(index);
      }

      if (token.type === tokens.number) {
        const index = t.indexLiteral(token.value);
        eatToken();

        return t.start(index);
      }

      throw new Error("Unknown start, token: " + tokenToString(token));
    }

    if (token.type === tokens.openParen) {
      eatToken();

      const startLoc = getStartLoc();

      if (isKeyword(token, keywords.export)) {
        eatToken();

        const node = parseExport();
        const endLoc = getEndLoc();

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.loop)) {
        eatToken();

        const node = parseLoop();
        const endLoc = getEndLoc();

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.func)) {
        eatToken();

        const node = parseFunc();
        const endLoc = getEndLoc();

        maybeIgnoreComment();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.module)) {
        eatToken();

        const node = parseModule();
        const endLoc = getEndLoc();

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.import)) {
        eatToken();

        const node = parseImport();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.block)) {
        eatToken();

        const node = parseBlock();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.memory)) {
        eatToken();

        const node = parseMemory();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.data)) {
        eatToken();

        const node = parseData();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.table)) {
        eatToken();

        const node = parseTable();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.global)) {
        eatToken();

        const node = parseGlobal();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.type)) {
        eatToken();

        const node = parseType();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.start)) {
        eatToken();

        const node = parseStart();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      if (isKeyword(token, keywords.elem)) {
        eatToken();

        const node = parseElem();
        const endLoc = getEndLoc();

        eatTokenOfType(tokens.closeParen);

        return t.withLoc(node, endLoc, startLoc);
      }

      const instruction = parseFuncInstr();
      const endLoc = getEndLoc();

      maybeIgnoreComment();

      if (typeof instruction === "object") {
        if (typeof token !== "undefined") {
          eatTokenOfType(tokens.closeParen);
        }

        return t.withLoc(instruction, endLoc, startLoc);
      }
    }

    if (token.type === tokens.comment) {
      const startLoc = getStartLoc();

      const builder =
        token.opts.type === "leading" ? t.leadingComment : t.blockComment;

      const node = builder(token.value);

      eatToken(); // comment

      const endLoc = getEndLoc();

      return t.withLoc(node, endLoc, startLoc);
    }

    throw createUnexpectedToken("Unknown token");
  }

  const body = [];

  while (current < tokensList.length) {
    body.push(walk());
  }

  return t.program(body);
}
