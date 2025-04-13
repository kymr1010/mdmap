use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::MouseEvent;

/// マウスの状態を管理する構造体
pub struct MouseState {
    pub x: f64,
    pub y: f64,
    pub is_clicked: bool,
}

impl MouseState {
    pub fn new() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            is_clicked: false,
        }
    }

    /// マウスの位置を更新
    pub fn update_position(&mut self, event: &MouseEvent) {
        self.x = event.client_x() as f64;
        self.y = event.client_y() as f64;
    }

    /// マウスのクリック状態を更新
    pub fn set_click(&mut self, clicked: bool) {
        self.is_clicked = clicked;
    }

    /// イベントリスナーを登録
    pub fn register_listeners(self_rc: &std::rc::Rc<std::cell::RefCell<Self>>, canvas: &web_sys::HtmlElement) -> Result<(), JsValue> {
        // マウスムーブイベント
        {
            let mouse_state_rc = self_rc.clone();
            let closure = Closure::wrap(Box::new(move |event: MouseEvent| {
                mouse_state_rc.borrow_mut().update_position(&event);
            }) as Box<dyn FnMut(MouseEvent)>);

            canvas.add_event_listener_with_callback("mousemove", closure.as_ref().unchecked_ref())?;
            closure.forget();
        }

        // マウスダウンイベント（クリック開始）
        {
            let mouse_state_rc = self_rc.clone();
            let closure = Closure::wrap(Box::new(move |_event: MouseEvent| {
                mouse_state_rc.borrow_mut().set_click(true);
            }) as Box<dyn FnMut(MouseEvent)>);

            canvas.add_event_listener_with_callback("mousedown", closure.as_ref().unchecked_ref())?;
            closure.forget();
        }

        // マウスアップイベント（クリック終了）
        {
            let mouse_state_rc = self_rc.clone();
            let closure = Closure::wrap(Box::new(move |_event: MouseEvent| {
                mouse_state_rc.borrow_mut().set_click(false);
            }) as Box<dyn FnMut(MouseEvent)>);

            canvas.add_event_listener_with_callback("mouseup", closure.as_ref().unchecked_ref())?;
            closure.forget();
        }

        // マウスエンターイベント （クリック判定）
        {
            let mouse_state_rc = self_rc.clone();
            let closure = Closure::wrap(Box::new(move |event: MouseEvent| {
                if event.buttons() == 0 {
                    mouse_state_rc.borrow_mut().set_click(false);
                }
            }) as Box<dyn FnMut(MouseEvent)>);
        
            canvas.add_event_listener_with_callback("mouseenter", closure.as_ref().unchecked_ref())?;
            closure.forget();
        }

        Ok(())
    }
}
