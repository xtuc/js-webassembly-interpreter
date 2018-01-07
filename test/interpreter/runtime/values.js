// @flow

const {assert} = require('chai');

const t = require('../../../lib/compiler/AST');
const modulevalue = require('../../../lib/interpreter/runtime/values/module');
const globalvalue = require('../../../lib/interpreter/runtime/values/global');
const tablevalue = require('../../../lib/interpreter/runtime/values/table');
const funcvalue = require('../../../lib/interpreter/runtime/values/func');
const i32 = require('../../../lib/interpreter/runtime/values/i32');
const i64 = require('../../../lib/interpreter/runtime/values/i64');
const f32 = require('../../../lib/interpreter/runtime/values/f32');
const f64 = require('../../../lib/interpreter/runtime/values/f64');
const label = require('../../../lib/interpreter/runtime/values/label');
const {Memory} = require('../../../lib/interpreter/runtime/values/memory');
const {createAllocator} = require('../../../lib/interpreter/kernel/memory');

describe('module create interface', () => {
  const memory = new Memory({initial: 100});
  const allocator = createAllocator(memory);

  describe('module exports', () => {

    it('should handle no export', () => {
      const node = t.module(undefined, []);
      const instance = modulevalue.createInstance(allocator, node);

      assert.typeOf(instance.exports, 'array');
      assert.lengthOf(instance.exports, 0);
    });

    it('should handle a func export', () => {
      const exportName = 'foo';

      const node = t.module(null, [
        t.func(t.identifier(exportName), [], null, []),
        t.moduleExport(exportName, 'Func', exportName)
      ]);

      const instance = modulevalue.createInstance(allocator, node);

      assert.typeOf(instance.exports, 'array');
      assert.lengthOf(instance.exports, 1);

      assert.equal(instance.exports[0].name, exportName);
      assert.equal(instance.exports[0].value.type, 'Func');

      assert.notEqual(instance.exports[0].value.addr.index, 0);
    });

  });

  describe('function instance', () => {

    it('return an instance', () => {
      const node = t.func(t.identifier('test'), [], null, []);
      const fromModule = t.module(undefined, []);

      const instance = funcvalue.createInstance(node, fromModule);

      assert.typeOf(instance.type, 'array');
      assert.lengthOf(instance.type, 2);
      assert.typeOf(instance.type[0], 'array');
      assert.typeOf(instance.type[1], 'array');

      assert.typeOf(instance.code, 'array');

      assert.typeOf(instance.module, 'object');

      assert.isFalse(instance.isExternal);
    });

    it('return an instance with arg and result types', () => {
      const args = [
        {id: 'a', valtype: 'i32'},
        {id: 'b', valtype: 'i32'},
      ];

      const result = 'i32';

      const node = t.func(t.identifier('test'), args, result, []);
      const fromModule = t.module(undefined, []);

      const instance = funcvalue.createInstance(node, fromModule);

      assert.deepEqual(instance.type[0], ['i32', 'i32']);
      assert.deepEqual(instance.type[1], ['i32']);
    });

    it('return an instance for external function', () => {
      const func = () => {};
      const instance = funcvalue.createExternalInstance(func);

      assert.typeOf(instance, 'object');
      assert.isTrue(instance.isExternal);

      assert.equal(instance.code, func);
    });
  });

  describe('integer 32bits', () => {

    it('createValue should return the correct value', () => {
      const v = i32.createValue(1);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1);
      assert.equal(v.type, 'i32');
    });

    it('createValue should overflow and result to 1', () => {
      const v = i32.createValue(Math.pow(2, 32) + 1);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1);
      assert.equal(v.type, 'i32');
    });

    it('createValue should return an int from a float', () => {
      const v = i32.createValue(1.1);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1);
      assert.equal(v.type, 'i32');
    });

  });

  describe('integer 64bits', () => {

    // TODO: replace these tests
  });

  describe('float 32bits', () => {

    it('createValue should return a float', () => {
      const v = f32.createValue(1.0);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1.0);
      assert.equal(v.type, 'f32');
    });

    it('createValue should return a float from a int', () => {
      const v = f32.createValue(1);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1.0);
      assert.equal(v.type, 'f32');
    });

  });

  describe('float 64bits', () => {

    it('createValue should return a float', () => {
      const v = f64.createValue(1.0);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1.0);
      assert.equal(v.type, 'f64');
    });

    it('createValue should return a float from a int', () => {
      const v = f64.createValue(1);

      assert.typeOf(v, 'object');
      assert.typeOf(v.type, 'string');
      assert.typeOf(v.value, 'number');

      assert.equal(v.value, 1.0);
      assert.equal(v.type, 'f64');
    });

  });

  it('label createValue should return the correct value', () => {
    const v = label.createValue('name');

    assert.typeOf(v, 'object');
    assert.typeOf(v.type, 'string');
    assert.typeOf(v.value, 'string');

    assert.equal(v.value, 'name');
    assert.equal(v.type, 'label');
  });

  describe('table', () => {

    it('should initialized with a given length', () => {
      const table = new tablevalue.Table({
        initial: 2,
        element: 'anyfunc',
      });

      assert.equal(table.length, 2);
      assert.isNull(table.get(0));
      assert.isNull(table.get(1));
    });

  });

  describe('global', () => {

    it('should have a value', () => {
      const initNode = t.objectInstruction(
        'const',
        'i32',
        [t.numberLiteral(10)]
      );

      const node = t.global(
        t.globalType('i32', 'const'),
        [initNode]
      );

      const instance = globalvalue.createInstance(allocator, node);

      assert.typeOf(instance, 'object');
      assert.equal(instance.mutability, 'const');
      assert.equal(instance.value, 10);
    });

  });

  it('module imports (external functions)', () => {
    const externalFunctions = {
      env: {
        test() {}
      }
    };

    const node = t.module(
      'module',
      [t.moduleImport(
        'env',
        'test',
        t.funcImportDescr(
          t.numberLiteral(0),
          ['i32', 'i32'],
          []
        )
      )]
    );

    const instance = modulevalue.createInstance(allocator, node, externalFunctions);

    assert.lengthOf(instance.funcaddrs, 1);

    const func = allocator.get(instance.funcaddrs[0]);

    assert.typeOf(func, 'object');
    assert.equal(func.code, externalFunctions.env.test);

    assert.typeOf(func.type, 'array');
    assert.deepEqual(func.type[0], ['i32', 'i32']);
    assert.deepEqual(func.type[1], []);
  });

});
