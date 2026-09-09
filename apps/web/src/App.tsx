import { healthResponseSchema, type HealthResponse } from "@internal-training/shared";
import { env } from "./config/env";

// Demonstrates that apps/web can consume @internal-training/shared contracts
// (compile-time type + runtime validation), without making an API call yet.
const exampleHealthResponse: HealthResponse = healthResponseSchema.parse({
  data: { status: "ok" },
});

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Internal Training Platform</h1>
        <p className="mt-2 text-sm text-slate-500">
          Frontend foundation running. No application features yet.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Shared contract check: {exampleHealthResponse.data.status}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Configured API base URL: {env.VITE_API_BASE_URL}
        </p>
      </div>
    </div>
  );
}

export default App;
