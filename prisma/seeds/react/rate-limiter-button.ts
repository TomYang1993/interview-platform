import { QuestionType, Difficulty, AccessTier } from '@prisma/client';
import type { SeedQuestion } from '../types';

const MAX_CLICKS = 5;
const WINDOW_MS = 10000;

const STARTER_CODE_REACT = `import React, { useState } from 'react';

const MAX_CLICKS = ${MAX_CLICKS};
const WINDOW_MS = ${WINDOW_MS};

export default function RateLimiterButton() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount((c) => c + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
      <button onClick={handleClick} style={{ padding: '10px 20px', fontSize: 16 }}>
        Click me
      </button>
      <div style={{ fontSize: 14, color: '#6b7280' }}>
        Clicks: {count}
      </div>
    </div>
  );
}`;

const STARTER_CODE_REACT_TS = `import React, { useState } from 'react';

const MAX_CLICKS = ${MAX_CLICKS};
const WINDOW_MS = ${WINDOW_MS};

export default function RateLimiterButton(): JSX.Element {
  const [count, setCount] = useState<number>(0);

  const handleClick = (): void => {
    setCount((c) => c + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
      <button onClick={handleClick} style={{ padding: '10px 20px', fontSize: 16 }}>
        Click me
      </button>
      <div style={{ fontSize: 14, color: '#6b7280' }}>
        Clicks: {count}
      </div>
    </div>
  );
}`;

const SOLUTION_CODE = `import React, { useState, useEffect, useCallback } from 'react';

const MAX_CLICKS = ${MAX_CLICKS};
const WINDOW_MS = ${WINDOW_MS};

export default function RateLimiterButton() {
  const [timestamps, setTimestamps] = useState([]);
  const [now, setNow] = useState(Date.now());

  const active = timestamps.filter((t) => now - t < WINDOW_MS);
  const remaining = Math.max(0, MAX_CLICKS - active.length);
  const isLimited = remaining === 0;

  const cooldownMs = isLimited ? Math.max(0, WINDOW_MS - (now - active[0])) : 0;
  const cooldownSec = Math.ceil(cooldownMs / 1000);

  // While limited: tick for smooth countdown, schedule precise prune
  // when the oldest click ages out of the window.
  useEffect(() => {
    if (!isLimited) return;

    const tick = setInterval(() => setNow(Date.now()), 250);

    const expireAt = WINDOW_MS - (Date.now() - active[0]);
    const prune = setTimeout(() => {
      setTimestamps((prev) => prev.filter((p) => Date.now() - p < WINDOW_MS));
      setNow(Date.now());
    }, Math.max(0, expireAt));

    return () => {
      clearInterval(tick);
      clearTimeout(prune);
    };
  }, [isLimited, active[0]]);

  // Re-check with a fresh Date.now() so rapid clicks before React commits
  // the disabled state can't slip past the cap.
  const handleClick = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setTimestamps((prev) => {
      const fresh = prev.filter((p) => t - p < WINDOW_MS);
      if (fresh.length >= MAX_CLICKS) return fresh;
      return [...fresh, t];
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 80 }}>
      <button
        onClick={handleClick}
        disabled={isLimited}
        style={{
          padding: '10px 20px',
          fontSize: 16,
          background: isLimited ? '#e5e7eb' : '#3b82f6',
          color: isLimited ? '#6b7280' : '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: isLimited ? 'not-allowed' : 'pointer',
        }}
      >
        Click me
      </button>
      <div data-testid="status" style={{ fontSize: 14, color: '#6b7280' }}>
        {isLimited && \`Rate limited. Try again in \${cooldownSec}s\`}
      </div>
    </div>
  );
}`;

const SOLUTION_EXPLANATION = `## Sliding window over click timestamps

The cleanest model for "N clicks per W milliseconds" is a sliding window: keep an array of recent click timestamps and consider any click within the last \`WINDOW_MS\` "active". The remaining quota is just:

\`\`\`js
const active = timestamps.filter((t) => now - t < WINDOW_MS);
const remaining = Math.max(0, MAX_CLICKS - active.length);
\`\`\`

When \`remaining === 0\` we're limited, and the **earliest** active timestamp determines when the next slot frees up:

\`\`\`js
const cooldownMs = WINDOW_MS - (now - active[0]);
\`\`\`

## Why a separate \`now\` state

The "remaining" and "cooldown" derive from \`Date.now() - timestamp\`, but React doesn't re-render just because real time advanced. We store \`now\` in state and update it on a 250ms interval **only while limited**, so the countdown ticks down smoothly without burning a timer when the button is free.

## One effect: tick + precise expiry

A single effect handles both the countdown tick and the prune. The tick (\`setInterval\`) drives the countdown text; alongside it we schedule a \`setTimeout\` that fires exactly when the oldest active click ages out of the window, prunes it from state, and lets React re-render with the button re-enabled:

\`\`\`js
useEffect(() => {
  if (!isLimited) return;

  const tick = setInterval(() => setNow(Date.now()), 250);

  const expireAt = WINDOW_MS - (Date.now() - active[0]);
  const prune = setTimeout(() => {
    setTimestamps((prev) => prev.filter((p) => Date.now() - p < WINDOW_MS));
    setNow(Date.now());
  }, Math.max(0, expireAt));

  return () => {
    clearInterval(tick);
    clearTimeout(prune);
  };
}, [isLimited, active[0]]);
\`\`\`

Adding \`active[0]\` to the deps means the timeout is rescheduled whenever the earliest active timestamp changes — so re-enable is event-driven (fires the moment the slot frees), not poll-driven (waiting for the next 250ms tick to notice). This also caps the \`timestamps\` array, which would otherwise grow unbounded over a long session.

## Rapid-click safety in the handler

The click handler re-checks the window using a fresh \`Date.now()\` reading (not the \`now\` state, which may lag the interval tick) and refuses to add a timestamp that would push past the limit. That makes the limiter robust even if the user hammers the button before React commits the disabled state:

\`\`\`js
setTimestamps((prev) => {
  const fresh = prev.filter((p) => t - p < WINDOW_MS);
  if (fresh.length >= MAX_CLICKS) return fresh;
  return [...fresh, t];
});
\`\`\`

## Followup

- Why is the disabled state derived (\`remaining === 0\`) rather than a separate piece of state?
- How would you persist the rate limit across page refresh? (\`localStorage\` of timestamps, prune on mount)

## Full Implementation`;

const PROMPT = `Build a **rate-limited button** that caps clicks at ${MAX_CLICKS} per ${WINDOW_MS / 1000}-second window.

### Requirements

1. The button accepts at most ${MAX_CLICKS} clicks within any rolling ${WINDOW_MS / 1000}-second window.
2. Once the cap is reached, disable the button.
3. When button is not limited, show \`N clicks remaining\` (singular when N === 1).
4. When limit hit, show \`Rate limited. Try again in Xs\` where \`X\` is the integer seconds until the next slot frees up.
5. The button must re-enable on its own (no extra interaction) the moment the oldest active click ages out of the window.

### Behavior Details

- The status text must live in an element with \`data-testid="status"\`.
- Treat \`MAX_CLICKS\` and \`WINDOW_MS\` as configurable constants at the top of the file.
- The cooldown countdown should update at least once per second while limited.
- Rapid double-clicks must not slip past the rate limit.`;

export const rateLimiterButton: SeedQuestion = {
  slug: 'rate-limiter-button',
  title: 'Rate Limiter Button',
  prompt: PROMPT,
  description: `Build a button rate limiting the clicks`,
  type: QuestionType.REACT_APP,
  difficulty: Difficulty.MEDIUM,
  accessTier: AccessTier.FREE,
  timeLimitMinutes: 45,
  tags: ['react', 'hooks', 'timers', 'state'],
  companies: ['Visa'],
  starterCode: {
    react: STARTER_CODE_REACT,
    reactTypescript: STARTER_CODE_REACT_TS,
  },
  publicTestCode: `test('renders an enabled button initially', () => {
  render(<UserComponent />);
  const button = screen.getByRole('button');
  expect(button.disabled).toBe(false);
});

test('disables after MAX_CLICKS rapid clicks', () => {
  render(<UserComponent />);
  const button = screen.getByRole('button');
  for (let i = 0; i < ${MAX_CLICKS}; i++) fireEvent.click(button);
  expect(button.disabled).toBe(true);
});

describe('with fake timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('shows a cooldown message with seconds when limited', () => {
    render(<UserComponent />);
    const button = screen.getByRole('button');
    for (let i = 0; i < ${MAX_CLICKS}; i++) fireEvent.click(button);
    expect(screen.getByTestId('status').textContent).toMatch(/Try again in \\d+s/);
  });

  test('re-enables after the window passes', async () => {
    render(<UserComponent />);
    const button = screen.getByRole('button');
    for (let i = 0; i < ${MAX_CLICKS}; i++) fireEvent.click(button);
    expect(button.disabled).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(${WINDOW_MS} + 500);
    });

    expect(button.disabled).toBe(false);
  });

  test('clicks beyond the cap are dropped, not queued', async () => {
    render(<UserComponent />);
    const button = screen.getByRole('button');
    for (let i = 0; i < ${MAX_CLICKS} + 10; i++) fireEvent.click(button);

    await act(async () => {
      jest.advanceTimersByTime(${WINDOW_MS} + 500);
    });

    expect(button.disabled).toBe(false);
  });
});`,
  solutions: [
    {
      language: 'javascript',
      code: SOLUTION_CODE,
      explanation: SOLUTION_EXPLANATION,
    },
  ],
};
