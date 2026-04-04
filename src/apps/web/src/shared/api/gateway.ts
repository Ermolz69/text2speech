import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

const API_BASE_URL = "/api";

export interface HealthResponse {
  status: "ok" | string;
  service: string;
}

function friendlyErrorMessage(status: number): string {
  if (status === 422) return "The text could not be processed. Please check your input.";
  if (status === 502) return "A backend service is unavailable. Make sure Docker is running.";
  if (status === 504) return "The request timed out. The service may be overloaded — try again.";
  if (status >= 500) return "A server error occurred. Check Docker logs for details.";
  if (status === 404) return "API endpoint not found. Check gateway configuration.";
  return `Request failed (${status}). Please try again.`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(friendlyErrorMessage(response.status));
  }
  return (await response.json()) as T;
}

function wrapNetworkError(error: unknown, context: string): never {
  if (error instanceof Error && !(error instanceof TypeError)) {
    throw error;
  }
  throw new Error(`Could not reach the ${context}. Is Docker running?`);
}

export async function analyzeText(payload: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<AnalyzeResponseDto>(response);
  } catch (error) {
    if (error instanceof TypeError) wrapNetworkError(error, "text analysis service");
    throw error;
  }
}

export async function synthesizeText(
  payload: SynthesizeRequestDto
): Promise<SynthesizeResponseDto> {
  try {
    const response = await fetch(`${API_BASE_URL}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseJsonResponse<SynthesizeResponseDto>(response);
  } catch (error) {
    if (error instanceof TypeError) wrapNetworkError(error, "synthesis service");
    throw error;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/health", { method: "GET" });
  return parseJsonResponse<HealthResponse>(response);
}
