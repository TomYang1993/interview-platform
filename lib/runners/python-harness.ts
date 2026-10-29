/**
 * Python test harness, shared by the in-browser Pyodide worker
 * (lib/runners/client/py-test-worker.ts) and the content import script
 * (scripts/import-questions.ts), so official solutions are verified with
 * exactly the grader users run against.
 *
 * Expects `solution.py` and `cases.json` in the working directory. Build it
 * with pythonHarness(), which fills in the entrypoint name and arg types.
 * Prints one `__RESULT__:<json>` line per case, or `__LOAD_ERROR__:<message>`.
 *
 * Arg types say how each positional arg is converted before the call:
 *   "json" (or missing) — passed as-is
 *   "tree"              — level-order list with nulls, e.g. [1, null, 2],
 *                         built into TreeNode objects (None for [])
 * TreeNode is defined in the solution's namespace before it runs, so user
 * code can reference it without declaring it.
 */
export const PYTHON_ARG_TYPES = ['json', 'tree'] as const;
export type PythonArgType = (typeof PYTHON_ARG_TYPES)[number];

export function pythonHarness(functionName: string, argTypes: readonly string[] = []): string {
  return PYTHON_HARNESS.replace('__FN_NAME__', functionName).replace('__ARG_TYPES__', JSON.stringify(argTypes));
}

const PYTHON_HARNESS = `
import json, sys, time, importlib.util
from collections import deque


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val!r})"


def build_tree(values):
    if not values or values[0] is None:
        return None
    it = iter(values)
    root = TreeNode(next(it))
    queue = deque([root])
    while queue:
        node = queue.popleft()
        for side in ("left", "right"):
            val = next(it, StopIteration)
            if val is StopIteration:
                return root
            if val is not None:
                child = TreeNode(val)
                setattr(node, side, child)
                queue.append(child)
    return root


CONVERTERS = {"json": lambda v: v, "tree": build_tree}
arg_types = __ARG_TYPES__


def convert_args(args):
    return [CONVERTERS[arg_types[i] if i < len(arg_types) else "json"](a) for i, a in enumerate(args)]


spec = importlib.util.spec_from_file_location("solution", "solution.py")
mod = importlib.util.module_from_spec(spec)
mod.TreeNode = TreeNode
try:
    spec.loader.exec_module(mod)
except Exception as e:
    print(f"__LOAD_ERROR__:{type(e).__name__}: {e}")
    sys.exit(0)

with open("cases.json") as f:
    cases = json.load(f)

fn_name = "__FN_NAME__"
fn = getattr(mod, fn_name, None)
if fn is None or not callable(fn):
    print(f"__LOAD_ERROR__:Function {fn_name!r} not found or not callable")
    sys.exit(0)

for case in cases:
    start = time.perf_counter()
    result = {"name": case["name"], "passed": False, "output": None, "runtimeMs": 0}
    try:
        output = fn(*convert_args(case["args"]))
        runtime_ms = int((time.perf_counter() - start) * 1000)
        result["runtimeMs"] = runtime_ms
        try:
            json.dumps(output)
            serializable = True
        except (TypeError, ValueError):
            serializable = False
        if not serializable:
            result["error"] = f"Return value is not JSON-serializable: {type(output).__name__}"
        else:
            result["output"] = output
            result["passed"] = output == case["expected"]
            if not result["passed"]:
                result["error"] = f"Expected {json.dumps(case['expected'])}, got {json.dumps(output)}"
    except Exception as e:
        result["runtimeMs"] = int((time.perf_counter() - start) * 1000)
        result["error"] = f"{type(e).__name__}: {e}"
    print("__RESULT__:" + json.dumps(result))
`.trimStart();
