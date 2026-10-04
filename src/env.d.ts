declare const __MODEL_INTEGRITY__: string

// Not yet in TypeScript's DOM lib.
interface TrustedTypePolicyFactory {
  createPolicy(name: string, rules: { createScriptURL?: (input: string) => string }): unknown
}
declare var trustedTypes: TrustedTypePolicyFactory | undefined
