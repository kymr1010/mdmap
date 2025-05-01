// use wasm_bindgen::prelude::*;
// use wasm_bindgen::JsCast;
use std::cell::RefCell;
use std::rc::Rc;

#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub async fn run() -> Result<(), wasm_bindgen::JsValue> {
  // panic 時のログ出力
  console_error_panic_hook::set_once();
  
  // 初期化時のログ出力
  web_sys::console::log_1(&"WASM module loaded and init called.".into());
  Ok(())
}
