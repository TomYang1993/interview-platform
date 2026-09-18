'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { QuestionType, Difficulty, AccessTier } from '@prisma/client';

const defaultStarterJs = `function solve(...args) {
  return null;
}`;

const defaultStarterPython = `def solve(*args):
    return None
`;

export interface AdminSolution {
  id: string;
  language: string;
  framework: string | null;
  explanation: string;
  code: string;
  complexity: string | null;
}

export interface QuestionInitialValues {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  description: string;
  tags: string[];
  companies: string[];
  starterCode: string;
  starterCodeTs?: string;
  type: QuestionType;
  difficulty: Difficulty;
  accessTier: AccessTier;
  timeLimitMinutes: number;
  isPublished: boolean;
  solutions: AdminSolution[];
}

interface Props {
  initial?: QuestionInitialValues;
}

export function AdminQuestionForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [companies, setCompanies] = useState(initial?.companies.join(', ') ?? '');
  const [starterCode, setStarterCode] = useState(initial?.starterCode ?? defaultStarterJs);
  const [starterCodeTs, setStarterCodeTs] = useState(initial?.starterCodeTs ?? '');
  const [type, setType] = useState<QuestionType>(initial?.type ?? 'FUNCTION_JS');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'EASY');
  const [accessTier, setAccessTier] = useState<AccessTier>(initial?.accessTier ?? 'FREE');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(initial?.timeLimitMinutes ?? 15);
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    setSubmitting(true);

    const starterCodeKey =
      type === 'REACT_APP' ? 'react' : type === 'FUNCTION_PYTHON' ? 'python' : 'javascript';

    const starterCodeMap: Record<string, string> = { [starterCodeKey]: starterCode };
    if (type === 'FUNCTION_JS' && starterCodeTs.trim()) {
      starterCodeMap.typescript = starterCodeTs;
    }

    const splitList = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);
    const tagList = splitList(tags);
    const companyList = splitList(companies);

    const body: Record<string, unknown> = {
      slug,
      title,
      prompt,
      type,
      difficulty,
      accessTier,
      isPublished,
      timeLimitMinutes,
      tags: tagList,
      companies: companyList,
      content: { description },
      starterCode: starterCodeMap,
    };

    if (!isEdit) {
      body.publicTestCode = `test('sample test', () => {\n  expect(solve([1, 2], 3)).toEqual([0, 1]);\n});`;
      body.hiddenTestCode = `test('hidden test', () => {\n  expect(solve([3, 2, 4], 6)).toEqual([1, 2]);\n});`;
    }

    try {
      const url = isEdit ? `/api/admin/questions/${initial!.id}` : '/api/admin/questions';
      const method = isEdit ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} question`);
      }

      if (isEdit) {
        setStatus(`Saved`);
        router.refresh();
      } else {
        setStatus(`Created question ${data.question.title}`);
        setSlug('');
        setTitle('');
        setPrompt('');
        setDescription('');
        setTags('');
        setCompanies('');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="form-stack admin-form">
      <h3>{isEdit ? `Edit: ${initial!.title}` : 'Create Question'}</h3>
      <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" required />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title" required />
      <label className="block">
        <span className="mb-1 block text-sm opacity-70">Description (one-sentence summary, shown in list)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="e.g. Retry a Promise-returning function up to N times with exponential backoff."
          className="w-full"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm opacity-70">Prompt (full markdown body)</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={12}
          placeholder="prompt (markdown)"
          required
          className="w-full"
        />
      </label>
      <div className="grid-two">
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="topic tags (comma-separated)"
          aria-label="Topic tags"
        />
        <input
          value={companies}
          onChange={(e) => setCompanies(e.target.value)}
          placeholder="companies asked at (comma-separated, e.g. Visa, Stripe)"
          aria-label="Companies"
        />
      </div>
      <div className="grid-two">
        <label>
          Type
          <select
            value={type}
            disabled={isEdit}
            onChange={(e) => {
              const val = e.target.value as QuestionType;
              setType(val);
              if (val === 'FUNCTION_PYTHON') setStarterCode(defaultStarterPython);
              else if (val !== 'REACT_APP') setStarterCode(defaultStarterJs);
            }}
          >
            <option value="FUNCTION_JS">FUNCTION_JS</option>
            <option value="REACT_APP">REACT_APP</option>
            <option value="FUNCTION_PYTHON">FUNCTION_PYTHON</option>
          </select>
        </label>
        <label>
          Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option value="EASY">EASY</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HARD">HARD</option>
          </select>
        </label>
      </div>
      <div className="grid-two">
        <label>
          Access Tier
          <select value={accessTier} onChange={(e) => setAccessTier(e.target.value as AccessTier)}>
            <option value="FREE">FREE</option>
            <option value="PREMIUM">PREMIUM</option>
          </select>
        </label>
        <label>
          Time limit (minutes)
          <input
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(e) => setTimeLimitMinutes(Number(e.target.value))}
            required
          />
        </label>
      </div>
      <label className="checkbox-line">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Published
      </label>
      <label className="block">
        Starter code ({type === 'REACT_APP' ? 'react' : type === 'FUNCTION_PYTHON' ? 'python' : 'javascript'})
        <textarea
          value={starterCode}
          onChange={(e) => setStarterCode(e.target.value)}
          rows={8}
          placeholder="starter code"
          required
        />
      </label>
      {type === 'FUNCTION_JS' ? (
        <label className="block">
          Starter code (typescript, optional)
          <textarea
            value={starterCodeTs}
            onChange={(e) => setStarterCodeTs(e.target.value)}
            rows={8}
            placeholder="typescript starter code (leave blank to omit)"
          />
        </label>
      ) : null}
      <button className="btn" disabled={submitting} type="submit">
        {submitting ? 'Saving...' : isEdit ? 'Save changes' : 'Create question'}
      </button>
      {status ? <p>{status}</p> : null}
      {isEdit && initial ? (
        <SolutionsPanel questionId={initial.id} initialSolutions={initial.solutions} />
      ) : null}
    </form>
  );
}

interface SolutionsPanelProps {
  questionId: string;
  initialSolutions: AdminSolution[];
}

function SolutionsPanel({ questionId, initialSolutions }: SolutionsPanelProps) {
  const router = useRouter();
  const [solutions, setSolutions] = useState<AdminSolution[]>(initialSolutions);
  const [newLanguage, setNewLanguage] = useState('javascript');
  const [newFramework, setNewFramework] = useState('');
  const [newExplanation, setNewExplanation] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newComplexity, setNewComplexity] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  function updateLocal(id: string, patch: Partial<AdminSolution>) {
    setSolutions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function saveSolution(sol: AdminSolution) {
    setError('');
    setBusyId(sol.id);
    try {
      const res = await fetch(`/api/admin/solutions/${sol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: sol.language,
          framework: sol.framework ?? null,
          explanation: sol.explanation,
          code: sol.code,
          complexity: sol.complexity ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save solution');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSolution(id: string) {
    if (!confirm('Delete this solution?')) return;
    setError('');
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/solutions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete solution');
      }
      setSolutions((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  async function createSolution() {
    setError('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/solutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          language: newLanguage,
          framework: newFramework || undefined,
          explanation: newExplanation,
          code: newCode,
          complexity: newComplexity || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create solution');
      setSolutions((prev) => [
        {
          id: data.solution.id,
          language: data.solution.language,
          framework: data.solution.framework,
          explanation: data.solution.explanation,
          code: data.solution.code,
          complexity: data.solution.complexity,
        },
        ...prev,
      ]);
      setNewFramework('');
      setNewExplanation('');
      setNewCode('');
      setNewComplexity('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="text-lg font-semibold">Official solutions</h3>
      {error ? <p className="text-red-500 text-sm">{error}</p> : null}

      <div className="mt-4 space-y-6">
        {solutions.length === 0 ? (
          <p className="text-sm opacity-60">No solutions yet.</p>
        ) : null}
        {solutions.map((sol) => (
          <div key={sol.id} className="border rounded p-3 space-y-2">
            <div className="grid-two">
              <label>
                Language
                <input
                  value={sol.language}
                  onChange={(e) => updateLocal(sol.id, { language: e.target.value })}
                />
              </label>
              <label>
                Framework
                <input
                  value={sol.framework ?? ''}
                  onChange={(e) =>
                    updateLocal(sol.id, { framework: e.target.value || null })
                  }
                />
              </label>
            </div>
            <label className="block">
              Explanation (markdown)
              <textarea
                rows={8}
                value={sol.explanation}
                onChange={(e) => updateLocal(sol.id, { explanation: e.target.value })}
              />
            </label>
            <label className="block">
              Code
              <textarea
                rows={10}
                value={sol.code}
                onChange={(e) => updateLocal(sol.id, { code: e.target.value })}
              />
            </label>
            <label className="block">
              Complexity
              <input
                value={sol.complexity ?? ''}
                onChange={(e) =>
                  updateLocal(sol.id, { complexity: e.target.value || null })
                }
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn"
                disabled={busyId === sol.id}
                onClick={() => saveSolution(sol)}
              >
                {busyId === sol.id ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={busyId === sol.id}
                onClick={() => deleteSolution(sol.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t pt-4 space-y-2">
        <h4 className="font-medium">Add new solution</h4>
        <div className="grid-two">
          <label>
            Language
            <input value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)} />
          </label>
          <label>
            Framework
            <input value={newFramework} onChange={(e) => setNewFramework(e.target.value)} />
          </label>
        </div>
        <label className="block">
          Explanation (markdown, min 10 chars)
          <textarea
            rows={6}
            value={newExplanation}
            onChange={(e) => setNewExplanation(e.target.value)}
          />
        </label>
        <label className="block">
          Code
          <textarea rows={8} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
        </label>
        <label className="block">
          Complexity
          <input value={newComplexity} onChange={(e) => setNewComplexity(e.target.value)} />
        </label>
        <button type="button" className="btn" disabled={creating} onClick={createSolution}>
          {creating ? 'Adding...' : 'Add solution'}
        </button>
      </div>
    </div>
  );
}
