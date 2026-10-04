// Vite and ONNX Runtime pass plain URLs to new Worker(); only same-origin scripts may load.
globalThis.trustedTypes?.createPolicy('default', {
  createScriptURL(input) {
    const url = new URL(input, location.href)
    if (url.origin !== location.origin) throw new TypeError(`Blocked script URL: ${input}`)
    return url.href
  },
})
