#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]

pub struct Vertex {
    position: [f32; 3],
    color: [f32; 3],
}

impl Vertex {
  pub fn new(position: [f32; 3], color: [f32; 3]) -> Self {
      Self { position, color }
  }
  pub fn desc() -> wgpu::VertexBufferLayout<'static> {
      wgpu::VertexBufferLayout {
          array_stride: std::mem::size_of::<Vertex>() as wgpu::BufferAddress,
          step_mode: wgpu::VertexStepMode::Vertex,
          attributes: &[
              wgpu::VertexAttribute {
                  offset: 0,
                  shader_location: 0,
                  format: wgpu::VertexFormat::Float32x3,
              },
              wgpu::VertexAttribute {
                  offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                  shader_location: 1,
                  format: wgpu::VertexFormat::Float32x3,
              }
          ]
      }
  }
}

pub struct ObjectState {
    vertex_buffer: wgpu::Buffer,
    num_vertices: u32,
}

impl ObjectState {
    pub fn new(device: &wgpu::Device, vertices: &[Vertex]) -> Self {
        let vertex_buffer = wgpu::util::DeviceExt::create_buffer_init(device, &wgpu::util::BufferInitDescriptor {
            label: Some("Vertex Buffer"),
            contents: bytemuck::cast_slice(vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });
        let num_vertices = vertices.len() as u32;
        Self { vertex_buffer, num_vertices }
    }

    pub fn vertex_buffer(&self) -> &wgpu::Buffer {
        &self.vertex_buffer
    }
}