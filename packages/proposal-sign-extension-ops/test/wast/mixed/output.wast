(module
  (func (param i32) (result i32)
    (get_local 0)
    (call 3)
    (call 4)
  )
  (func (param i32) (result i32)
    (get_local 0)
  )
  (func (param i32) (result i32)
    (get_local 0)
    (call 4)
  )
  (func $i32_extend16_s (param i32) (result i32)
    (get_local 0)
    (i32.const -32768)
    (i32.or)
    (get_local 0)
    (i32.const 32767)
    (i32.and)
    (get_local 0)
    (i32.const 32768)
    (i32.and)
    (select)
  )
  (func $i32_extend8_s (param i32) (result i32)
    (get_local 0)
    (i32.const -128)
    (i32.or)
    (get_local 0)
    (i32.const 127)
    (i32.and)
    (get_local 0)
    (i32.const 128)
    (i32.and)
    (select)
  )
)
