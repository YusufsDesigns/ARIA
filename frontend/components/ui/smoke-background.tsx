'use client'

import { useEffect, useRef } from 'react'

interface SmokeBackgroundProps {
  smokeColor?: string
  className?: string
}

function parseColor(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16) / 255,
      parseInt(hex.slice(2, 4), 16) / 255,
      parseInt(hex.slice(4, 6), 16) / 255,
    ]
  }
  return [1, 0.42, 0.21]
}

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

// Atmospheric smoke — visible full-canvas glow, readable text
const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2  u_res;
uniform vec3  u_color;

float hash(vec2 p) {
  p  = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.31);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),             hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2  rot = mat2(cos(0.7), -sin(0.7), sin(0.7), cos(0.7));
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p  = rot * p * 2.1 + vec2(1.7, 9.2);
    a *= 0.48;
  }
  return v;
}

void main() {
  vec2 uv  = gl_FragCoord.xy / u_res;
  float ar = u_res.x / u_res.y;

  float t = u_time * 0.045;

  vec2 p = uv * vec2(ar, 1.0) * 2.4;
  vec2 q = vec2(fbm(p + t * 0.9),
                fbm(p + vec2(5.2, 1.3) + t * 0.7));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.4),
                fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.3));

  float f = fbm(p + 4.5 * r + t * 0.2);

  // Visible range — shows across most of the canvas
  f = smoothstep(0.30, 0.75, f);

  // Gentle center bias — brighter in the center, not zero at edges
  float cx = length((uv - vec2(0.5, 0.44)) * vec2(0.9, 1.1));
  float vignette = 1.0 - smoothstep(0.2, 1.1, cx);
  vignette = max(vignette, 0.25); // floor so edges still show some smoke

  // Colour layers: pure black → muted orange → saturated orange peak
  vec3 col = mix(vec3(0.0),       u_color * 0.50, f);
  col       = mix(col,            u_color * 0.80, f * f);
  col       = mix(col,            u_color,        f * f * f * vignette * 0.70);

  // Alpha: vivid but stays behind text — max 0.75
  float alpha = f * (0.70 + 0.30 * vignette);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.75));
}
`

export function SmokeBackground({ smokeColor = '#FF6B35', className }: SmokeBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const t0Ref     = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
    })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[SmokeBackground] shader error:', gl.getShaderInfoLog(s))
      }
      return s
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[SmokeBackground] link error:', gl.getProgramInfoLog(prog))
    }
    gl.useProgram(prog)

    // Full-screen quad
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uTime  = gl.getUniformLocation(prog, 'u_time')
    const uRes   = gl.getUniformLocation(prog, 'u_res')
    const uColor = gl.getUniformLocation(prog, 'u_color')

    const [r, g, b] = parseColor(smokeColor)
    gl.uniform3f(uColor, r, g, b)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const resize = () => {
      const w = canvas.offsetWidth  || window.innerWidth
      const h = canvas.offsetHeight || window.innerHeight
      canvas.width  = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    t0Ref.current = performance.now()

    const render = () => {
      const t = (performance.now() - t0Ref.current) / 1000
      gl.uniform1f(uTime, t)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      rafRef.current = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [smokeColor])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  )
}
