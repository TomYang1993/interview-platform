'use client';

import { ChevronDown } from 'lucide-react';

const selectClass =
  'appearance-none bg-surface border border-line text-ink text-[0.85rem] max-md:text-base font-medium h-10 pr-8 pl-3 rounded-[6px] outline-none cursor-pointer transition-colors duration-150 hover:border-brand focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

interface QuestionsFiltersProps {
  type: string;
  difficulty: string;
  status: string;
  onChange: (key: 'type' | 'difficulty' | 'status', value: string) => void;
}

export function QuestionsFilters({ type, difficulty, status, onChange }: QuestionsFiltersProps) {
  return (
    <>
      <div className="relative">
        <select
          className={selectClass}
          value={type}
          onChange={(e) => onChange('type', e.target.value)}
        >
          <option value="">Category: All</option>
          <option value="REACT_APP">UI</option>
          <option value="FUNCTION_JS">JS/TS Logic</option>
          <option value="FUNCTION_PYTHON">Backend</option>
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
      </div>

      <div className="relative">
        <select
          className={selectClass}
          value={difficulty}
          onChange={(e) => onChange('difficulty', e.target.value)}
        >
          <option value="">Difficulty: All</option>
          <option value="EASY">Entry</option>
          <option value="MEDIUM">Mid</option>
          <option value="HARD">Senior+</option>
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
      </div>

      <div className="relative">
        <select
          className={selectClass}
          value={status}
          onChange={(e) => onChange('status', e.target.value)}
        >
          <option value="">Status: All</option>
          <option value="solved">Completed</option>
          <option value="attempted">Attempted</option>
          <option value="unattempted">Not Started</option>
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
      </div>
    </>
  );
}
