import type { AnalyticsEventParams, AnalyticsParamPrimitive } from '@/lib/analytics/types';

export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'dashboard_view',
  'create_view',
  'set_view',
  'game_view',
  'settings_view',
  'source_mode_change',
  'pdf_extract_start',
  'pdf_extract_result',
  'terms_generate_start',
  'terms_generate_result',
  'set_save',
  'set_cancel',
  'set_cache_action',
  'game_data_load_start',
  'game_data_load_result',
  'game_session_start',
  'game_session_exit',
  'game_session_complete',
  'tutor_open',
  'tutor_message_send',
  'tutor_message_result',
  'tutor_reset',
  'quiz_ai_explain_open',
  'studytable_search',
  'studytable_cell_toggle',
  'studytable_column_toggle',
  'studytable_shuffle',
  'studytable_reset_pattern',
  'studytable_help_toggle',
  'flashcards_flip',
  'flashcards_classify',
  'flashcards_cycle',
  'flashcards_retry',
  'flashcards_restart',
  'flashcards_pass_complete',
  'quiz_answer_select',
  'quiz_next_prev',
  'quiz_finish',
  'quiz_restart',
  'quiz_ai_explain',
  'matching_attempt',
  'matching_complete',
  'typein_submit',
  'typein_next',
  'typein_complete',
  'typein_restart',
  'chatbot_prompt_click',
  'chatbot_send',
  'chatbot_response',
  'chatbot_reset',
  'chatbot_open_popup',
  'unscramble_drag_reorder',
  'unscramble_shuffle',
  'unscramble_check',
  'unscramble_puzzle_complete',
  'unscramble_game_complete',
  'snowman_guess',
  'snowman_hint',
  'snowman_round_complete',
  'snowman_game_complete',
  'hungrybug_run_start_pause_resume_restart',
  'hungrybug_speed_change',
  'hungrybug_food_hit',
  'hungrybug_run_end',
  'bugmatch_run_start_pause_restart',
  'bugmatch_move',
  'bugmatch_ant_hit',
  'bugmatch_life_change',
  'bugmatch_run_end',
  'chopped_chunk_select_remove',
  'chopped_check',
  'chopped_give_up',
  'chopped_restart',
  'chopped_complete',
  'crossword_cell_input',
  'crossword_direction_toggle',
  'crossword_clue_focus',
  'crossword_reveal_clue',
  'crossword_reveal_all',
  'crossword_clear',
  'crossword_complete',
  'test_answer_save',
  'test_nav',
  'test_finish',
  'test_restart',
  'api_request_start',
  'api_request_result',
  'personalization_setting_change',
  'personalized_pack_refresh',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

const ALLOWED_PARAM_KEYS = new Set([
  'path',
  'route_kind',
  'set_id',
  'game_type',
  'source_type',
  'source',
  'result',
  'action',
  'mode',
  'api_route',
  'api_mode',
  'status_code',
  'error_code',
  'duration_ms',
  'duration_bucket',
  'item_count',
  'terms_count',
  'cards_count',
  'score',
  'score_bucket',
  'correct',
  'correct_count',
  'wrong_count',
  'attempts',
  'retries',
  'progress',
  'index',
  'question_kind',
  'direction',
  'speed_preset',
  'lives',
  'reason',
  'consent',
  'analytics_session_id',
  'env',
  'provider',
  'has_warning',
  'selected',
  'answered_count',
  'total_count',
  'elapsed_ms',
  'file_size_bucket',
  'value',
]);

const BLOCKED_KEYS = new Set([
  'apiKey',
  'sourceContent',
  'topic',
  'tutorInstruction',
  'messages',
  'terms',
  'pdfText',
  'prompt',
  'content',
  'text',
  'title',
  'description',
]);

function normalizeParamValue(value: unknown): AnalyticsParamPrimitive | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 1000) / 1000;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 120);
  }
  return null;
}

export function sanitizeAnalyticsParams(input: AnalyticsEventParams | undefined) {
  const sanitized: Record<string, AnalyticsParamPrimitive> = {};
  if (!input) return sanitized;

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_PARAM_KEYS.has(key)) continue;
    if (BLOCKED_KEYS.has(key)) continue;
    const normalized = normalizeParamValue(value);
    if (normalized === null) continue;
    sanitized[key] = normalized;
  }

  return sanitized;
}
