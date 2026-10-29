'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { MarkdownProse } from '@/components/markdown-prose';
import { useFetch } from '@/lib/hooks/use-fetch';
import { useSyntaxTheme } from '@/lib/hooks/use-syntax-theme';

export interface SolutionView {
  id: string;
  language: string;
  title: string | null;
  framework: string | null;
  explanation: string;
  code: string;
  complexity: string | null;
}

interface SolutionsTabProps {
  questionId: string;
}

export function SolutionsTab({ questionId }: SolutionsTabProps) {
  const syntaxTheme = useSyntaxTheme();
  const { data, loading, error } = useFetch<SolutionView[]>(`/api/questions/${questionId}/solutions`);

  if (loading) {
    return <p className="text-muted text-center py-8">Loading official solutions...</p>;
  }
  if (error) {
    return <p className="text-muted text-center py-8">Couldn&apos;t load solutions. Try again.</p>;
  }
  const solutions = Array.isArray(data) ? data : [];
  if (solutions.length === 0) {
    return <p className="text-muted text-center py-8">No official solutions published yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {solutions.map((sol) => (
        <article key={sol.id} className="bg-surface-raised border border-line rounded-md p-6">
          {sol.title && <h3 className="text-[1rem] font-bold mb-2">{sol.title}</h3>}
          <div className="flex gap-4 text-[0.75rem] text-muted mb-4 uppercase tracking-[0.05em]">
            <span>{sol.language}</span>
            {sol.complexity && <span>{sol.complexity}</span>}
          </div>
          <MarkdownProse className="text-[0.9rem]">{sol.explanation}</MarkdownProse>
          <div className="mt-4 rounded-md overflow-hidden">
            <SyntaxHighlighter
              style={syntaxTheme}
              language={sol.language === 'python' || sol.language === 'typescript' ? sol.language : 'javascript'}
              customStyle={{ margin: 0, borderRadius: '0.375rem', fontSize: '0.82rem', lineHeight: '1.6' }}
            >
              {sol.code}
            </SyntaxHighlighter>
          </div>
        </article>
      ))}
    </div>
  );
}
