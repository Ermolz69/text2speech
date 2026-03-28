import type {
  AnalyzeRequestDto,
  AnalyzeResponseDto,
  SynthesizeRequestDto,
  SynthesizeResponseDto,
} from "shared";

const API_BASE_URL = "/api";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function analyzeText(payload: AnalyzeRequestDto): Promise<AnalyzeResponseDto> {
  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<AnalyzeResponseDto>(response);
}

export async function synthesizeText(
  payload: SynthesizeRequestDto
): Promise<SynthesizeResponseDto> {
  const response = await fetch(`${API_BASE_URL}/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseJsonResponse<SynthesizeResponseDto>(response);
}
