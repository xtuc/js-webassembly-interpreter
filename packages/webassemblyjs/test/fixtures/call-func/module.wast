(module 
  (func $one (result i32)
    (i32.const 1)
  )
  (func (result i32)
    (call $one)
  )
  (export "callByName" (func $func_1))
  (func (result i32)
    (call 1)
  )
  (export "callByIndex" (func $func_2))
)
