// wrangler가 .wasm import를 WebAssembly.Module로 묶는다(og-render.ts, T-10-068).
declare module '*.wasm' {
  const module: WebAssembly.Module;
  export default module;
}
