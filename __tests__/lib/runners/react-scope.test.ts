import { describe, expect, it } from 'vitest';
import { withReactInScope } from '@/lib/runners/react-scope';

describe('withReactInScope', () => {
  it('appends a React import when only hooks are imported', () => {
    const code = "import { useState } from 'react';\nexport default function App() { return <div />; }";
    const out = withReactInScope(code);
    expect(out.startsWith(code)).toBe(true);
    expect(out).toMatch(/\nimport React from 'react';\n$/);
  });

  it('appends when there are no imports at all', () => {
    expect(withReactInScope('export default () => <p />;')).toContain("import React from 'react';");
  });

  it.each([
    "import React from 'react';",
    "import React, { useState } from 'react';",
    'import * as React from "react";',
    "  import React from 'react';",
  ])('leaves code alone when it already has %s', (line) => {
    const code = `${line}\nexport default function App() { return <div />; }`;
    expect(withReactInScope(code)).toBe(code);
  });

  it('ignores a commented-out React import', () => {
    const code = "// import React from 'react';\nexport default () => <p />;";
    expect(withReactInScope(code)).toContain("\nimport React from 'react';");
  });
});
