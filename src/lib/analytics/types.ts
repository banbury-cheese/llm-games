export type AnalyticsConsent = 'granted' | 'denied' | 'unset';

export type AnalyticsParamPrimitive = string | number | boolean;

export type AnalyticsEventParams = Record<string, AnalyticsParamPrimitive | null | undefined>;

export interface AnalyticsConfig {
  measurementId: string;
  forceEnabled: boolean;
  env: string;
}

export interface SanitizedAnalyticsPayload {
  event: string;
  params: Record<string, AnalyticsParamPrimitive>;
}

export interface ServerAnalyticsInput {
  event: string;
  clientId: string;
  params?: AnalyticsEventParams;
}

export const ANALYTICS_CONSENT_KEY = 'llm-games:analytics-consent';
export const ANALYTICS_SESSION_KEY = 'llm-games:analytics-session-id';

