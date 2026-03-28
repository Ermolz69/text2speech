export type ApiErrorCode =
  | "validation_error"
  | "internal_error"
  | "upstream_timeout"
  | "upstream_error";

export interface ApiErrorDetail {
  location: string;
  message: string;
  code: string;
}

export interface ApiErrorEnvelope {
  code: ApiErrorCode;
  message: string;
  status: number;
  path: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiErrorEnvelope;
}

export const apiErrorExample: ApiErrorResponse = {
  error: {
    code: "validation_error",
    message: "Request validation failed",
    status: 422,
    path: "/api/analyze",
    details: [
      {
        location: "body.text",
        message: "Field required",
        code: "missing",
      },
    ],
  },
};
