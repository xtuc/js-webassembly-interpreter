const { decode } = require("@webassemblyjs/wasm-parser");
const { parse } = require("@webassemblyjs/wast-parser");
const wabt = require("wabt");
const {
  getFixtures,
  compareWithExpected
} = require("@webassemblyjs/helper-test-framework");

const { toIR, dumpIR } = require("../lib");

function wast2Wasm(suite, txt) {
  const module = wabt.parseWat(suite, txt);
  const { buffer } = module.toBinary({ write_debug_names: true });

  return buffer;
}

describe("wasm compiler", () => {
  const testSuites = getFixtures(__dirname, "fixtures", "**/actual.wast");
  const pre = (f, suite) => dumpIR(toIR(decode(wast2Wasm(suite, f))));

  compareWithExpected(testSuites, pre, "expected-ir.txt");
});

describe("wast compiler", () => {
  const testSuites = getFixtures(__dirname, "fixtures", "**/actual.wast");
  const pre = f => dumpIR(toIR(parse(f)));

  compareWithExpected(testSuites, pre, "expected-ir-wast.txt");
});
