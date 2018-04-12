(module 
  (memory $memory_0 1)
  (func $load (param i32) (result i32)
    (get_local 0)
    (i32.load)
  )
  (func $load_with_offset (param i32) (result i32)
    (get_local 0)
    (i32.load)
  )
  (export "memory")
  (export "load" (func $load))
  (export "load_with_offset" (func $load_with_offset))
)
