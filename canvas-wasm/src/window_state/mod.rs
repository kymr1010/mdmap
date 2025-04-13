use std::{cell::RefCell, rc::Rc};

use web_sys::Event;
use wgpu;

use crate::mouse_state::MouseState;
use crate::object_state::{self, ObjectState};

pub struct Size {
  width: u32,
  height: u32,
}
pub struct WindowState {
  surface: wgpu::Surface<'static>,
  device: wgpu::Device,
  queue: wgpu::Queue,
  config: wgpu::SurfaceConfiguration,
  size: Size,
  clear_color: wgpu::Color,
  // surface には canvas のリソースに対する安全でない参照が含まれるため
  // canvas は surface の後に削除されるよう surface の後に宣言されなければならない
  window: web_sys::Window,
  canvas: web_sys::HtmlCanvasElement,
  render_pipeline: wgpu::RenderPipeline,
}

impl WindowState {
  // 一部のwgpuの型の作成には非同期コードが必要
  pub async fn new(window: web_sys::Window) -> Result<Rc<RefCell<Self>>, wasm_bindgen::JsValue> {
    // HTML からキャンバス要素を取得
    let document = window.document().expect("No document");
    let canvas = wasm_bindgen::JsCast::dyn_into::<web_sys::HtmlCanvasElement>(document
        .get_element_by_id("my_canvas")
        .expect("No canvas with id my_canvas"))
        .expect("Element is not a canvas");

    let width = window.inner_width().expect("No inner width").as_f64().expect("inner width is not a number") as u32;
    let height = window.inner_height().expect("No inner height").as_f64().expect("inner width is not a number") as u32;
    let size = Size { width, height };

    // 初期の背景色（クリアカラー）
    let clear_color = wgpu::Color { r: 0.0, g: 0.0, b: 0.0, a: 1.0 };

    // wgpu のインスタンスを作成
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::all(),
        ..wgpu::InstanceDescriptor::default()
    });

    // canvas から surface を作成（canvas は clone して渡す）
    let surface = instance
        .create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone()))
        .expect("Failed to create surface");

    // アダプター（グラフィックデバイス）をリクエスト
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::default(),
            compatible_surface: Some(&surface),
            force_fallback_adapter: false,
        })
        .await
        .expect("Failed to get adapter");

    // デバイスとキューを作成
    let (device, queue) = adapter
        .request_device(
            &wgpu::DeviceDescriptor {
              label: None,
              required_features: wgpu::Features::empty(),
              // Chrome 135b deprecates downlevel_webgl2_defaults
              // required_limits: if cfg!(target_arch = "wasm32") {
              //     wgpu::Limits::downlevel_webgl2_defaults()
              // } else {
              //     wgpu::Limits::default()
              // },
              required_limits: wgpu::Limits::downlevel_defaults(), // wgpu::Limits::default(),
              memory_hints: wgpu::MemoryHints::MemoryUsage,
              trace: wgpu::Trace::Off,
            }
        )
        .await
        .expect("Failed to create device");

    // surface の能力を取得し、フォーマットなどを決定
    let surface_caps = surface.get_capabilities(&adapter);
    let surface_format = surface_caps
      .formats
      .iter()
      .copied()
      .filter(|f| f.is_srgb())
      .next()
      .unwrap_or(surface_caps.formats[0]);

    // サーフェスの設定
    let config = wgpu::SurfaceConfiguration {
      usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
      format: surface_format,
      width: size.width,
      height: size.height,
      present_mode: surface_caps.present_modes[0],
      alpha_mode: surface_caps.alpha_modes[0],
      view_formats: vec![],
      desired_maximum_frame_latency: 0,
    };
    surface.configure(&device, &config);

    // シェーダーを作成
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
      label: Some("Shader"),
      source: wgpu::ShaderSource::Wgsl(include_str!("shader.wgsl").into()),
    });

    // パイプラインを作成
    let render_pipeline_layout =
    device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
      label: Some("Render Pipeline Layout"),
      bind_group_layouts: &[],
      push_constant_ranges: &[],
    });

    // レンダーパイプラインを作成
    let render_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
      label: Some("Render Pipeline"),
      layout: Some(&render_pipeline_layout),
      cache: None,
      vertex: wgpu::VertexState {
        module: &shader,
        entry_point: Some("vs_main"), // 1.
        buffers: &[],
        compilation_options: wgpu::PipelineCompilationOptions::default(), // 2.
      },
      fragment: Some(wgpu::FragmentState { // 3.
        module: &shader,
        entry_point: Some("fs_main"),
        targets: &[Some(wgpu::ColorTargetState { // 4.
            format: config.format,
            blend: Some(wgpu::BlendState::REPLACE),
            write_mask: wgpu::ColorWrites::ALL,
        })],
        compilation_options: wgpu::PipelineCompilationOptions::default(),
      }),
      primitive: wgpu::PrimitiveState {
        topology: wgpu::PrimitiveTopology::TriangleList, // 1.
        strip_index_format: None,
        front_face: wgpu::FrontFace::Ccw, // 2.
        cull_mode: Some(wgpu::Face::Back),
        // Fill 以外に設定する場合は Features::NON_FILL_POLYGON_MODE が必要です。
        polygon_mode: wgpu::PolygonMode::Fill,
        // Features::DEPTH_CLIP_CONTROLが必要
        unclipped_depth: false,
        // Features::CONSERVATIVE_RASTERIZATION が必要
        conservative: false,
      },
      depth_stencil: None, // 1.
      multisample: wgpu::MultisampleState {
          count: 1, // 2.
          mask: !0, // 3.
          alpha_to_coverage_enabled: false, // 4.
      },
      multiview: None, // 5.
    });

    // State のインスタンスを生成
    let state = Self {
        surface,
        device,
        queue,
        config,
        size,
        clear_color,
        window: window.clone(),
        canvas: canvas.clone(),
        render_pipeline,
    };

    // Rc<RefCell<State>> に包んで返す
    Ok(Rc::new(RefCell::new(state)))
  }

  pub fn window(&self) -> &web_sys::Window {
    &self.window
  }

  pub fn device(&self) -> &wgpu::Device {
    &self.device
  }

  pub fn canvas(&self) -> &web_sys::HtmlCanvasElement {
    &self.canvas
  }

  pub fn size(&self) -> &Size {
    &self.size
  }

  pub fn resize(&mut self, new_size: Size) {
    if new_size.width > 0 && new_size.height > 0 {
      self.config.width = new_size.width;
      self.config.height = new_size.height;
      self.size = new_size;
      self.surface.configure(&self.device, &self.config);
    }
  }

  pub fn input(&mut self, mouse_state: &mut MouseState) -> bool {
    self.clear_color = wgpu::Color {
      r: mouse_state.x / self.size.width as f64,
      g: mouse_state.y / self.size.height as f64,
      b: if mouse_state.is_clicked { 1.0 } else { 0.0 },
      a: 1.0,
    };
    true
  }

  pub fn update(&mut self) {
    // 何もしない
  }

  pub fn render(&mut self, object_state: Rc<RefCell<ObjectState>>) -> Result<(), wgpu::SurfaceError> {
    let output = self.surface.get_current_texture()?;
    let view = output.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
      label: Some("Render Encoder"),
    });

    {
      let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
        label: Some("Render Pass"),
        color_attachments: &[Some(wgpu::RenderPassColorAttachment {
          view: &view,
          resolve_target: None,
          ops: wgpu::Operations {
            load: wgpu::LoadOp::Clear(wgpu::Color {
                r: self.clear_color.r,
                g: self.clear_color.g,
                b: self.clear_color.b,
                a: self.clear_color.a,
            }),
            store: wgpu::StoreOp::Store,
          },
        })],
        depth_stencil_attachment: None,
        occlusion_query_set: None,
        timestamp_writes: None,
      });
      render_pass.set_pipeline(&self.render_pipeline); // 2.
      render_pass.set_vertex_buffer(0, object_state.borrow().vertex_buffer().slice(..));
      render_pass.draw(0..3, 0..1);
    }


    // submit will accept anything that implements IntoIter
    self.queue.submit(std::iter::once(encoder.finish()));
    output.present();

    Ok(())
  }
}