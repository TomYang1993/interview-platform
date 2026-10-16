'use client';

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useSyntaxTheme } from '@/lib/hooks/use-syntax-theme';
import { CALLOUT_RE, type CalloutKind } from '@/lib/markdown-callouts';

interface MarkdownProseProps {
  children: string;
  className?: string;
}

/* ── Obsidian-style callout parsing ──────────────────────────── */

interface Segment {
  type: 'markdown' | 'callout';
  content: string;
  calloutKind?: CalloutKind;
  calloutTitle?: string;
}

function parseCallouts(markdown: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of markdown.matchAll(CALLOUT_RE)) {
    if (match.index! > lastIndex) {
      segments.push({ type: 'markdown', content: markdown.slice(lastIndex, match.index!) });
    }
    const kind = match[1] as CalloutKind;
    segments.push({
      type: 'callout',
      calloutKind: kind,
      calloutTitle: match[2] || kind.charAt(0).toUpperCase() + kind.slice(1),
      content: match[3].replace(/^> ?/gm, '').trim(),
    });
    lastIndex = match.index! + match[0].length;
  }

  if (lastIndex < markdown.length) {
    segments.push({ type: 'markdown', content: markdown.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'markdown', content: markdown }];
}

const CALLOUT_STYLES: Record<CalloutKind, { border: string; bg: string; icon: string }> = {
  tip:     { border: 'border-l-amber-400',  bg: 'bg-amber-500/[0.06]',  icon: '\u{1F4A1}' },
  info:    { border: 'border-l-blue-400',   bg: 'bg-blue-500/[0.06]',   icon: '\u{2139}\uFE0F' },
  warning: { border: 'border-l-orange-400', bg: 'bg-orange-500/[0.06]', icon: '\u{26A0}\uFE0F' },
  note:    { border: 'border-l-violet-400', bg: 'bg-violet-500/[0.06]', icon: '\u{1F4DD}' },
};

/* ── Shared ReactMarkdown components ─────────────────────────── */

function useMarkdownComponents(syntaxTheme: Record<string, React.CSSProperties>): Components {
  return {
    code({ children, className: codeClassName, node, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      if (match) {
        return (
          <SyntaxHighlighter
            style={syntaxTheme}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '0.375rem',
              fontSize: '0.82rem',
              lineHeight: '1.6',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        );
      }
      // Untagged fenced block (parent is <pre>) — render as preformatted, preserve whitespace
      const isBlock = (node as { tagName?: string } | undefined)?.tagName === 'code'
        && String(children).includes('\n');
      if (isBlock) {
        return (
          <code className="block font-mono text-[0.82rem] leading-[1.6] whitespace-pre" {...props}>
            {String(children).replace(/\n$/, '')}
          </code>
        );
      }
      return (
        <code
          className="bg-surface-raised border border-line px-1.5 py-0.5 rounded text-[0.85em] font-mono text-brand"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre({ children }) {
      return (
        <pre className="my-4 bg-surface-raised border border-line rounded-md p-3 overflow-x-auto">
          {children}
        </pre>
      );
    },
    p({ children }) {
      return <p className="mb-4 last:mb-0">{children}</p>;
    },
    ul({ children }) {
      return <ul className="list-disc pl-5 mb-4 flex flex-col gap-1.5">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 mb-4 flex flex-col gap-1.5">{children}</ol>;
    },
    li({ children }) {
      return <li className="leading-[1.6]">{children}</li>;
    },
    h1({ children }) {
      return <h1 className="text-xl font-bold mb-3 mt-6 first:mt-0">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mb-2 mt-5 first:mt-0">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-base font-bold mb-2 mt-4 first:mt-0">{children}</h3>;
    },
    strong({ children }) {
      return <strong className="font-bold text-ink">{children}</strong>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-[3px] border-brand pl-4 my-4 text-ink-secondary italic">
          {children}
        </blockquote>
      );
    },
    hr() {
      return <hr className="border-line my-6" />;
    },
    a({ children, href }) {
      return (
        <a href={href} className="text-brand underline underline-offset-2 hover:text-brand-hover transition-colors" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
  };
}

/* ── Callout block ───────────────────────────────────────────── */

function CalloutBlock({
  kind,
  title,
  content,
  components,
}: {
  kind: CalloutKind;
  title: string;
  content: string;
  components: Components;
}) {
  const style = CALLOUT_STYLES[kind];
  return (
    <div className={`${style.border} ${style.bg} border-l-[3px] rounded-r-lg px-4 py-3 my-5`}>
      <p className="font-semibold text-ink mb-1.5 flex items-center gap-2 text-[0.92rem]">
        <span>{style.icon}</span>
        <span>{title}</span>
      </p>
      <div className="text-ink-secondary text-[0.88rem] leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0">
        <ReactMarkdown components={components}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */

/**
 * Renders markdown content with prose-like typography and syntax-highlighted code blocks.
 * Supports Obsidian-style callouts: > [!tip] Title
 */
export function MarkdownProse({ children, className = '' }: MarkdownProseProps) {
  const syntaxTheme = useSyntaxTheme();
  const components = useMarkdownComponents(syntaxTheme);
  const segments = parseCallouts(children);

  return (
    <div className={`markdown-prose ${className}`}>
      {segments.map((segment, i) =>
        segment.type === 'callout' ? (
          <CalloutBlock
            key={i}
            kind={segment.calloutKind!}
            title={segment.calloutTitle!}
            content={segment.content}
            components={components}
          />
        ) : (
          <ReactMarkdown key={i} components={components}>
            {segment.content}
          </ReactMarkdown>
        )
      )}
    </div>
  );
}
