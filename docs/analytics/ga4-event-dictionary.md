# GA4 Event Dictionary

## Privacy Rules
- No API keys, prompt text, chat content, PDF text, term/definition content, source content, tutor instruction, or user-entered free text is sent.
- Consent-gated: events send only when user consent is `granted`.
- Production-gated by default (`NODE_ENV=production`) unless `NEXT_PUBLIC_ANALYTICS_FORCE=true`.
- Session-only ID: `llm-games:analytics-session-id` is stored in `sessionStorage`.

## Core Env Vars
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `GA_API_SECRET`
- `NEXT_PUBLIC_ANALYTICS_FORCE`

## Common Params
- `set_id`
- `game_type`
- `result`
- `action`
- `index`
- `score`
- `total_count`
- `duration_ms`
- `duration_bucket`
- `api_route`
- `api_mode`
- `provider`
- `speed_preset`

## Global Events
- `page_view`
- `dashboard_view`
- `create_view`
- `set_view`
- `game_view`
- `settings_view`

## Funnel Events
- `source_mode_change`
- `pdf_extract_start`
- `pdf_extract_result`
- `terms_generate_start`
- `terms_generate_result`
- `set_save`
- `set_cancel`
- `set_cache_action`

## Game Shell Events
- `game_data_load_start`
- `game_data_load_result`
- `game_session_start`
- `game_session_exit`
- `game_session_complete`

## Tutor Events
- `tutor_open`
- `tutor_message_send`
- `tutor_message_result`
- `tutor_reset`
- `quiz_ai_explain_open`

## Game-Specific Events
### Study Table
- `studytable_search`
- `studytable_cell_toggle`
- `studytable_column_toggle`
- `studytable_shuffle`
- `studytable_reset_pattern`
- `studytable_help_toggle`

### Flashcards
- `flashcards_flip`
- `flashcards_classify`
- `flashcards_cycle`
- `flashcards_retry`
- `flashcards_restart`
- `flashcards_pass_complete`

### Quiz
- `quiz_answer_select`
- `quiz_next_prev`
- `quiz_finish`
- `quiz_restart`
- `quiz_ai_explain`

### Matching
- `matching_attempt`
- `matching_complete`

### Type In
- `typein_submit`
- `typein_next`
- `typein_complete`
- `typein_restart`

### Chat Bot
- `chatbot_prompt_click`
- `chatbot_send`
- `chatbot_response`
- `chatbot_reset`
- `chatbot_open_popup`

### Unscramble
- `unscramble_drag_reorder`
- `unscramble_shuffle`
- `unscramble_check`
- `unscramble_puzzle_complete`
- `unscramble_game_complete`

### Snowman
- `snowman_guess`
- `snowman_hint`
- `snowman_round_complete`
- `snowman_game_complete`

### Hungry Bug
- `hungrybug_run_start_pause_resume_restart`
- `hungrybug_speed_change`
- `hungrybug_food_hit`
- `hungrybug_run_end`

### Bug Match
- `bugmatch_run_start_pause_restart`
- `bugmatch_move`
- `bugmatch_ant_hit`
- `bugmatch_life_change`
- `bugmatch_run_end`

### Chopped
- `chopped_chunk_select_remove`
- `chopped_check`
- `chopped_give_up`
- `chopped_restart`
- `chopped_complete`

### Crossword
- `crossword_cell_input`
- `crossword_direction_toggle`
- `crossword_clue_focus`
- `crossword_reveal_clue`
- `crossword_reveal_all`
- `crossword_clear`
- `crossword_complete`

### Test Mode
- `test_answer_save`
- `test_nav`
- `test_finish`
- `test_restart`

## Server Reliability Events (GA4 MP)
- `api_request_start`
- `api_request_result`

### Route Coverage
- `/api/generate`
- `/api/chat`
- `/api/pdf-extract`

### API Params
- `api_route`
- `api_mode`
- `provider`
- `result` (`start|success|error`)
- `status_code`
- `error_code`
- `duration_ms`
- `duration_bucket`
- `file_size_bucket` (pdf only)
