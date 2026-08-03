export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  errors: ApiErrorDetail[];
  meta?: {
    timestamp?: string;
    requestId?: string;
  };
}
