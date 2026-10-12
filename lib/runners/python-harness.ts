/**
 * Python test harness, shared by the in-browser Pyodide worker
 * (lib/runners/client/py-test-worker.ts) and the content import script
 * (scripts/import-questions.ts), so official solutions are verified with
 * exactly the grader users run against.
 *
 * Expects `solution.py` and `cases.json` in the working directory and the
 * `__FN_NAME__` placeholder replaced with the entrypoint name. Prints one
 * `__RESULT__:<json>` line per case, or `__LOAD_ERROR__:<message>`.
 */
export const PYTHON_HARNESS = `
import json, sys, time, importlib.util

spec = importlib.util.spec_from_file_location("solution", "solution.py")
mod = importlib.util.module_from_spec(spec)
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
        output = fn(*case["args"])
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
