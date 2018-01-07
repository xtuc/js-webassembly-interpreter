// @flow

const {assert} = require('chai');

const t = require('../../../../lib/compiler/AST');
const {executeStackFrame} = require('../../../../lib/interpreter/kernel/exec');
const {createStackFrame} = require('../../../../lib/interpreter/kernel/stackframe');

describe('kernel exec - numeric instructions', () => {

  const operations = [

    /**
     * Integer 32 bits
     */

    {
      name: 'i32.add',

      args: [
        {value: 1, type: 'i32'},
        {value: 1, type: 'i32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('add', 'i32'),
      ],

      resEqual: 2,
    },

    {
      name: 'i32.sub',

      args: [
        {value: 1, type: 'i32'},
        {value: 1, type: 'i32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('sub', 'i32'),
      ],

      resEqual: 0,
    },

    {
      name: 'i32.mul',

      args: [
        {value: 2, type: 'i32'},
        {value: 1, type: 'i32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('mul', 'i32'),
      ],

      resEqual: 2,
    },

    {
      name: 'i32.div_s',

      args: [
        {value: 2, type: 'i32'},
        {value: 10, type: 'i32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('div_s', 'i32'),
      ],

      resEqual: 5,
    },

    {
      name: 'i32.div_u',

      args: [
        {value: 2, type: 'i32'},
        {value: 10, type: 'i32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('div_u', 'i32'),
      ],

      resEqual: 5,
    },


    /**
     * Integer 64 bits
     * 
     * TODO: put these tests back in place!
     */


    /**
     * Float 32 bits
     */

    {
      name: 'f32.add',

      args: [
        {value: 1.0, type: 'f32'},
        {value: 1.0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('add', 'f32'),
      ],

      resEqual: 2,
    },

    {
      name: 'f32.sub',

      args: [
        {value: 1.0, type: 'f32'},
        {value: 1.0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('sub', 'f32'),
      ],

      resEqual: 0,
    },

    {
      name: 'f32.mul',

      args: [
        {value: 2.0, type: 'f32'},
        {value: 1.0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('mul', 'f32'),
      ],

      resEqual: 2,
    },

    {
      name: 'f32.div',

      args: [
        {value: 2.0, type: 'f32'},
        {value: 10.0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('div', 'f32'),
      ],

      resEqual: 5.0,
    },

    {
      name: 'f32.min',

      args: [
        {value: 5.0, type: 'f32'},
        {value: 1000.7, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: 5.0,
    },

    {
      name: 'f32.min',

      args: [
        {value: +0, type: 'f32'},
        {value: -0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: -0,
    },

    {
      name: 'f32.min',

      args: [
        {value: Infinity, type: 'f32'},
        {value: -Infinity, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: -Infinity,
    },

    {
      name: 'f32.min',

      args: [
        {value: Infinity, type: 'f32'},
        {value: 1234, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: 1234,
    },

    {
      name: 'f32.min',

      args: [
        {value: NaN, type: 'f32'},
        {value: 1234, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: NaN,
    },

    {
      name: 'f32.min',

      args: [
        {value: 0.0000000000000000000000001, type: 'f32'},
        {value: 0.00000000000000000000000001, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f32'),
      ],

      resEqual: 0.00000000000000000000000001,
    },

    {
      name: 'f32.max',

      args: [
        {value: 5.0, type: 'f32'},
        {value: 1000.7, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: 1000.7,
    },

    {
      name: 'f32.max',

      args: [
        {value: +0, type: 'f32'},
        {value: -0, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: +0,
    },

    {
      name: 'f32.max',

      args: [
        {value: Infinity, type: 'f32'},
        {value: -Infinity, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: Infinity,
    },

    {
      name: 'f32.max',

      args: [
        {value: Infinity, type: 'f32'},
        {value: 1234, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: Infinity,
    },

    {
      name: 'f32.max',

      args: [
        {value: NaN, type: 'f32'},
        {value: 1234, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: NaN,
    },

    {
      name: 'f32.max',

      args: [
        {value: 0.0000000000000000000000001, type: 'f32'},
        {value: 0.00000000000000000000000001, type: 'f32'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f32'),
      ],

      resEqual: 0.0000000000000000000000001,
    },

    /**
     * Float 64 bits
     */

    {
      name: 'f64.add',

      args: [
        {value: 1.0, type: 'f64'},
        {value: 1.0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('add', 'f64'),
      ],

      resEqual: 2.0,
    },

    {
      name: 'f64.sub',

      args: [
        {value: 1.0, type: 'f64'},
        {value: 1.0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('sub', 'f64'),
      ],

      resEqual: 0,
    },

    {
      name: 'f64.mul',

      args: [
        {value: 2.0, type: 'f64'},
        {value: 1.0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('mul', 'f64'),
      ],

      resEqual: 2.0,
    },

    {
      name: 'f64.div',

      args: [
        {value: 2.0, type: 'f64'},
        {value: 10.0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('div', 'f64'),
      ],

      resEqual: 5.0,
    },

    {
      name: 'f64.min',

      args: [
        {value: 5.0, type: 'f64'},
        {value: 1000.7, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: 5.0,
    },

    {
      name: 'f64.min',

      args: [
        {value: +0, type: 'f64'},
        {value: -0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: -0,
    },

    {
      name: 'f64.min',

      args: [
        {value: Infinity, type: 'f64'},
        {value: -Infinity, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: -Infinity,
    },

    {
      name: 'f64.min',

      args: [
        {value: Infinity, type: 'f64'},
        {value: 1234, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: 1234,
    },

    {
      name: 'f64.min',

      args: [
        {value: NaN, type: 'f64'},
        {value: 1234, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: NaN,
    },

    {
      name: 'f64.min',

      args: [
        {value: 0.0000000000000000000000001, type: 'f64'},
        {value: 0.00000000000000000000000001, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('min', 'f64'),
      ],

      resEqual: 0.00000000000000000000000001,
    },

    {
      name: 'f64.max',

      args: [
        {value: 5.0, type: 'f64'},
        {value: 1000.7, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: 1000.7,
    },

    {
      name: 'f64.max',

      args: [
        {value: +0, type: 'f64'},
        {value: -0, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: +0,
    },

    {
      name: 'f64.max',

      args: [
        {value: Infinity, type: 'f64'},
        {value: -Infinity, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: Infinity,
    },

    {
      name: 'f64.max',

      args: [
        {value: Infinity, type: 'f64'},
        {value: 1234, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: Infinity,
    },

    {
      name: 'f64.max',

      args: [
        {value: NaN, type: 'f64'},
        {value: 1234, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: NaN,
    },

    {
      name: 'f64.max',

      args: [
        {value: 0.0000000000000000000000001, type: 'f64'},
        {value: 0.00000000000000000000000001, type: 'f64'},
      ],

      code: [
        t.instruction('get_local', [t.numberLiteral(0)]),
        t.instruction('get_local', [t.numberLiteral(1)]),
        t.objectInstruction('max', 'f64'),
      ],

      resEqual: 0.0000000000000000000000001,
    },

  ];

  operations.forEach((op) => {

    describe(op.name, () => {
      it('should get the correct result', () => {

        const stackFrame = createStackFrame(op.code, op.args);
        const res = executeStackFrame(stackFrame).value;

        assert.deepEqual(res, op.resEqual);

      });

      it('should assert validations - 1 missing arg', () => {
        const stackFrame = createStackFrame(op.code, op.args.slice(-1));
        const fn = () => executeStackFrame(stackFrame);

        assert.throws(fn, /Assertion error/);
      });
    });

  });


});
