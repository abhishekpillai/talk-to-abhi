import type { ApiResponse } from "./types";

export function jsonResponse<T>(body: ApiResponse<T>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? (body.success ? 200 : 400),
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}
