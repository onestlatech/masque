declare const __MODEL_INTEGRITY__: string

// Not yet in TypeScript's DOM lib.
interface TrustedTypePolicyFactory {
  createPolicy(name: string, rules: { createScriptURL?: (input: string) => string }): unknown
}
declare var trustedTypes: TrustedTypePolicyFactory | undefined

// Worker-only OPFS API, missing from the DOM lib.
interface FileSystemSyncAccessHandle {
  read(buffer: AllowSharedBufferSource, options?: { at?: number }): number
  write(buffer: AllowSharedBufferSource, options?: { at?: number }): number
  getSize(): number
  flush(): void
  close(): void
}
interface FileSystemFileHandle {
  createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>
}
