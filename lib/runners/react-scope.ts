const REACT_DEFAULT_IMPORT = /^\s*import\s+(?:React\b|\*\s+as\s+React\b)/m;

/**
 * Sandpack's test bundler compiles JSX with the classic runtime, which needs
 * `React` in scope, while the preview uses the automatic runtime and doesn't.
 * Without this, code that only imports hooks renders fine in the preview but
 * fails every test with "React is not defined". Appended rather than
 * prepended so error line numbers still match the editor — imports hoist.
 */
export function withReactInScope(code: string): string {
  return REACT_DEFAULT_IMPORT.test(code) ? code : `${code}\nimport React from 'react';\n`;
}
