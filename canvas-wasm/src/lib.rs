// use wasm_bindgen::prelude::*;
// use wasm_bindgen::JsCast;
use std::cell::RefCell;
use std::rc::Rc;

mod window_state;
use window_state::WindowState;
mod mouse_state;
use mouse_state::MouseState;
mod object_state;
use object_state::ObjectState;
use wasm_bindgen::JsCast;

#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub async fn run() -> Result<(), wasm_bindgen::JsValue> {
  // panic 時のログ出力
  console_error_panic_hook::set_once();
  
  // 初期化時のログ出力
  web_sys::console::log_1(&"WASM module loaded and init called.".into());

  // HTML からキャンバス要素を取得
  let window: web_sys::Window = web_sys::window().ok_or("No global window").expect("No global window");

  let window_state_rc = WindowState::new(window.clone()).await?;
  let mouse_state_rc = Rc::new(RefCell::new(MouseState::new()));
  let object_state_rc = Rc::new(RefCell::new(ObjectState::new(window_state_rc.borrow().device(), &[
    object_state::Vertex::new([0.0, 0.5, 0.0], [1.0, 0.0, 0.0]),
    object_state::Vertex::new([0.0, -0.5, 0.0], [0.0, 1.0, 0.0]),
    object_state::Vertex::new([0.5, 0.0, 0.0], [0.0, 0.0, 1.0]),
    object_state::Vertex::new([-0.5, 0.0, 0.0], [1.0, 1.0, 1.0]),
    object_state::Vertex::new([-0.5, 0.0, 0.0], [1.0, 1.0, 1.0]),
  ])));

  mouse_state::MouseState::register_listeners(&mouse_state_rc, window_state_rc.borrow().canvas())?;

  // ループ内で再帰的に呼び出すためのクロージャを保持する Rc<RefCell<Option<Closure<dyn FnMut()>>>>
  let f: Rc<RefCell<Option<wasm_bindgen::prelude::Closure<dyn FnMut()>>>> = Rc::new(RefCell::new(None));
  let g: Rc<RefCell<Option<wasm_bindgen::prelude::Closure<dyn FnMut()>>>> = f.clone();

  // クロージャを定義
  *g.borrow_mut() = Some(wasm_bindgen::prelude::Closure::wrap(Box::new(move || {
      // State の更新
      let window_state_rc_clone = window_state_rc.clone();
      let mouse_state_rc_clone = mouse_state_rc.clone();

      window_state_rc_clone.borrow_mut().input(&mut mouse_state_rc_clone.borrow_mut());
      window_state_rc_clone.borrow_mut().update();
      // 描画処理。エラーはコンソールに出力
      if let Err(e) = window_state_rc_clone.borrow_mut().render(object_state_rc.clone()) {
          web_sys::console::error_1(&"error".into());
      }
      // 次のフレームのスケジューリング
      let window = web_sys::window().expect("should have a window");
      window
          .request_animation_frame(
              f.borrow().as_ref().unwrap().as_ref().unchecked_ref(),
          )
          .expect("should register `requestAnimationFrame` OK");
  }) as Box<dyn FnMut()>));

  // 初回のフレームをスケジュール
  window
      .request_animation_frame(
          g.borrow().as_ref().unwrap().as_ref().unchecked_ref(),
      )
      .expect("should register `requestAnimationFrame` OK");

  Ok(())
}
