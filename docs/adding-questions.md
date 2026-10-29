# Adding questions

New questions live in the private content repo, **not** in `prisma/seeds/`. This repo is public, so anything committed here (solutions, hidden tests, premium prompts) is readable by anyone. `prisma/seeds/` stays as the fixture set for local dev and tests.

## Content repo layout

One folder per question, named after its slug:

```
questions/<slug>/
  question.json              metadata
  prompt.md                  full prompt (markdown) shown in the editor
  starter/<key>.<ext>        starter code; <key> is the starterCode key
  solutions/<key>.<ext>      official solution; <key> is the language, optionally
                             followed by an approach: python.py, python.iterative.py
  solutions/<key>.md         explanation for that solution
  tests/public.json          FUNCTION_PYTHON: visible cases
  tests/hidden.json          FUNCTION_PYTHON: graded on submit
  tests/public.js            FUNCTION_JS / REACT_APP: Jest-style test code
  tests/hidden.js
```

`question.json`:

```json
{
  "slug": "my-question",
  "title": "My Question",
  "description": "One-line summary for the question list.",
  "type": "FUNCTION_PYTHON",
  "difficulty": "MEDIUM",
  "accessTier": "FREE",
  "timeLimitMinutes": 30,
  "tags": ["tree", "dfs"],
  "companies": ["Visa"],
  "functionName": "my_function",
  "complexity": { "python": "O(n) time, O(n) space" }
}
```

- `type` is one of `FUNCTION_JS`, `REACT_APP`, `FUNCTION_PYTHON`.
- `accessTier`: use `FREE` for now. Questions may move to `PREMIUM` later, but everything ships free until then.
- `companies` become "Asked at" company tags. The logo comes from `<name>.com` with spaces and punctuation removed, so use the company's usual name (`Goldman Sachs`, not `GS`).
- `functionName` is required for Python and must be a **top-level function**. The grader calls it by name, so `class Solution` won't work.
- Starter keys: `python`, `javascript`, `typescript`, `react`, `reactTypescript`.
- Python test case: `{ "name": "...", "args": [...], "expected": ... }`. `args` is spread into the call, and the output is compared with `==` after a JSON round-trip.
- Hidden tests are sent to the browser on submit, so keep stress cases around 10⁴ elements rather than 10⁵.

### Tree arguments

Set `argTypes` to have the grader convert args before the call, one entry per positional arg:

```json
"functionName": "find_min_path",
"argTypes": ["tree"]
```

- `"tree"`: the test case holds a level-order list with `null` gaps, e.g. `[5, 4, 8, 11, null, 13, 4]`. The grader builds `TreeNode` objects (`val`, `left`, `right`) and passes the root, or `None` for `[]`.
- `"json"`: passed as-is (the default when `argTypes` is omitted).
- `TreeNode` is defined in the solution's namespace before it runs, so starter code can use it in type hints without declaring it. Show the class in a comment so users know its shape.
- Return values still go through the JSON comparison, so return plain lists or numbers, not nodes.

### Several approaches

A question can ship more than one official solution per language, e.g. a recursive one plus an iterative follow-up:

```
solutions/python.py            solutions/python.md
solutions/python.iterative.py  solutions/python.iterative.md
```

```json
"complexity": { "python": "O(n) time, O(h) space", "python.iterative": "O(n) time, O(h) space" },
"solutionTitles": { "python": "Recursive DFS", "python.iterative": "Iterative DFS · follow-up" }
```

- `solutionTitles` gives each card its heading. Its order is the order on the Solutions tab. It's required for every solution of a language that has more than one.
- The importer verifies every approach against all the tests.
- Put a follow-up in the prompt as a `### Follow-up` section after Constraints. It isn't graded separately, so the tests have to stay within limits both approaches can pass.

## Importing

```bash
npx tsx scripts/import-questions.ts ../interview-platform-content/questions
```

Every run:

1. Loads and validates each question folder.
2. Runs each official solution against the public and hidden tests, using the same harness users are graded by. Python runs on your local `python3`; JS/TS runs in-process. It also warns if the starter code already passes every test. React questions aren't verified automatically.
3. Diffs each question against the target DB.

It's a dry run unless you pass `--write`. Any validation or verification failure aborts the whole run before anything is written.

| Flag | Effect |
|---|---|
| `--write` | Apply changes. New questions are created as **drafts**. |
| `--publish` | Publish the imported questions. Without it, existing questions keep their current published state. |
| `--overwrite` | Allow updating an existing question whose DB copy differs. The DB copy may hold admin-UI edits, so without this flag the run stops and shows the diff. |

The local `python3` may be older than the Pyodide runtime users get (Python 3.13). Stick to syntax your local version supports, or install a newer `python3`.

## Shipping to production

If the question relies on a platform change that hasn't been released yet (a new `question.json` field such as `argTypes` or `solutionTitles`, or a new grader feature), cut a release first. See [releasing.md](releasing.md).

1. Add or edit the question in the content repo and open a PR there.
2. Dry run against local, then write it:
   `npx tsx scripts/import-questions.ts ../interview-platform-content/questions/<slug> --write`
3. Dry run against production. Use the **direct** (port 5432) connection, not the pooler:
   `DATABASE_URL="$PROD_DIRECT_URL" npx tsx scripts/import-questions.ts ../interview-platform-content/questions/<slug>`
   Check that the `Target DB:` line is the one you expect.
4. Re-run with `--write`. The question lands as a draft.
5. Review it on its `/admin` edit page, then publish with the toggle (or re-run with `--publish`). Drafts don't render on the solve page, so do the full solve-and-submit check locally first (`--publish` against your local DB).

If you edit a question in the admin UI, copy the change back into the content repo. Otherwise the next import shows it as a diff and refuses to overwrite it without `--overwrite`.
