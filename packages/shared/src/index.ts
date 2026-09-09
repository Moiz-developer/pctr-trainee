// Public entry point of @internal-training/shared.
// This package holds only pure types, constants, and Zod contract schemas —
// no business logic, no authorization logic, no database/framework code
// (see SYSTEM_PLAN.md §29/§30 and this step's architectural boundary).

export * from "./types/common.js";
export * from "./api/common.js";
export * from "./api/health.js";
