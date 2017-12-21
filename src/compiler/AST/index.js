// @flow

function assert(cond: boolean) {
  if (!cond) {
    throw new Error('assertion error');
  }
}

export function identifier(name: string): Identifier {
  return {
    type: 'Identifier',
    name,
  };
}

export function program(body: Array<Node>): Program {
  return {
    type: 'Program',
    body,
  };
}

export function module(id: ?string, fields: ModuleFields): Module {
  if (id != null) {
    assert(typeof id === 'string');
  }

  assert(typeof fields === 'object' && typeof fields.length !== 'undefined');

  return {
    type: 'Module',
    id,
    fields,
  };
}

export function moduleExport(name: string, type: ExportDescr, id: string): ModuleExport {
  return {
    type: 'ModuleExport',
    name,
    descr: {
      type,
      id,
    }
  };
}

export function func(
  id: ?string,
  params: Array<FuncParam>,
  result: ?Valtype,
  body: Array<Instruction>,
): Func {
  return {
    type: 'Func',
    id,
    params,
    result,
    body,
  };
}

export function objectInstruction(
  id: string,
  object: Valtype,
  args: Array<Number | string> = [],
): Instruction {
  assert(typeof args === 'object' && typeof args.length !== 'undefined');
  assert(typeof object === 'string');

  return {
    type: 'Instr',
    id,
    object,
    args,
  };
}

export function instruction(id: string, args: Array<Number | string> = []): Instruction {
  assert(typeof args === 'object' && typeof args.length !== 'undefined');
  assert(id !== 'block');
  assert(id !== 'if');
  assert(id !== 'loop');

  return {
    type: 'Instr',
    id,
    args,
  };
}

export function loopInstruction(
  label: ?Identifier,
  resulttype: ?Valtype,
  instr: Array<Instruction>,
): LoopInstruction {
  assert(typeof instr === 'object' && typeof instr.length !== 'undefined');

  return {
    type: 'LoopInstruction',
    id: 'loop',
    label,
    resulttype,
    instr,
  };
}

export function blockInstruction(
  label: Identifier,
  instr: Array<Instruction>,
): BlockInstruction {
  assert(typeof label !== 'undefined');
  assert(typeof instr === 'object' && typeof instr.length !== 'undefined');

  return {
    type: 'BlockInstruction',
    id: 'block',
    label,
    instr,
  };
}

export function numberLiteral(
  value: number,
): NumberLiteral {

  return {
    type: 'NumberLiteral',
    value,
  };
}

export function callInstruction(
  index: Index,
): CallInstruction {

  return {
    type: 'CallInstruction',
    id: 'call',
    index,
  };
}

export function ifInstruction(
  test: Index,
  result: ?Valtype,
  consequent: Array<Instruction>,
  alternate: Array<Instruction>,
): IfInstruction {

  return {
    type: 'IfInstruction',
    id: 'if',
    test,
    result,
    consequent,
    alternate,
  };
}

export function withLoc(n: Node, end: Position, start: Position): Node {
  const loc = {
    start,
    end,
  };

  n.loc = loc;

  return n;
}

/**
 * Import
 */

export function moduleImport(
  module: string,
  name: string,
  descr: ImportDescr,
): ModuleImport {

  return {
    type: 'ModuleImport',
    module,
    name,
    descr,
  };
}

export function globalImportDescr(
  valtype: Valtype,
  mutability: Mutability,
): GlobalImportDescr {

  return {
    type: 'GlobalImportDescr',
    elementType: 'anyfunc',

    valtype,
    mutability,
  };
}

export function funcImportDescr(
  value: NumberLiteral | Identifier,
  params: Array<FuncParam> = [],
  results: Array<Valtype> = [],
): FuncImportDescr {
  assert(typeof params === 'object' && typeof params.length !== 'undefined');
  assert(typeof results === 'object' && typeof results.length !== 'undefined');

  return {
    type: 'FuncImportDescr',
    value,
    params,
    results,
  };
}

export function table(elementType: string, limits: Limit): Table {

  return {
    type: 'Table',
    elementType,
    limits,
  };
}

export function limits(min: number, max?: number): Limit {

  return {
    type: 'Limit',
    min,
    max,
  };
}

export function memory(limits: Limit, id: ?Identifier): Memory {

  return {
    type: 'Memory',
    limits,
    id,
  };
}

export function data(memoryIndex: Index, offset: Array<Node>, init: ByteArray): Data {

  return {
    type: 'Data',
    memoryIndex,
    offset,
    init,
  };
}

export function global(globalType: GlobalType, init: Array<Node>): Global {

  return {
    type: 'Global',
    globalType,
    init,
  };
}

export function globalType(valtype: Valtype, mutability: Mutability): GlobalType {

  return {
    type: 'GlobalType',
    valtype,
    mutability,
  };
}

export function byteArray(values: Array<Byte>): ByteArray {
  return {
    type: 'Bytes',
    values,
  };
}

export function brTableInstruction(
  labels: Array<Index>,
  label: Index,
): BrTableInstruction {

  return {
    type: 'BrTableInstruction',
    id: 'br_table',
    labels,
    label
  };
}
