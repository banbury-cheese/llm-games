# GA4 Reports and Explorations

## Quick Setup Checklist
1. Create a GA4 web data stream for the production domain.
2. Set env vars: `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `GA_API_SECRET`.
3. Deploy, open the app, and grant analytics consent once.
4. In GA4 DebugView, verify `page_view`, `dashboard_view`, and `game_session_start` arrive.
5. Register custom dimensions: `game_type`, `source_type`, `result`, `question_kind`, `speed_preset`, `api_route`, `api_mode`, `duration_bucket`, `score_bucket`.
6. Mark conversions: `set_save`, `game_session_complete`, `quiz_finish`, `test_finish`, `flashcards_pass_complete`.
7. Build the four explorations in this doc (funnel, usage/completion, game quality, API reliability).
8. Confirm no events are sent before consent and that revoking consent stops new events.

## Conversions
Mark these events as conversions in GA4:
- `set_save`
- `game_session_complete`
- `quiz_finish`
- `test_finish`
- `flashcards_pass_complete`

## Recommended Custom Dimensions
Create event-scoped custom dimensions/metrics for:
- `game_type`
- `source_type`
- `result`
- `question_kind`
- `speed_preset`
- `api_route`
- `api_mode`
- `duration_bucket`
- `score_bucket`

## Exploration 1: Acquisition to Activation Funnel
Steps:
1. `dashboard_view`
2. `create_view`
3. `terms_generate_result` (`result=success|fallback`)
4. `set_save`
5. `set_view`
6. `game_session_start`
7. `game_session_complete`

Breakdowns:
- `source_type`
- `game_type`

## Exploration 2: Game Usage and Completion
Metrics:
- `game_session_start` count
- `game_session_complete` count
- completion rate (`complete / start`)
- median `duration_ms` from `game_session_exit`

Breakdowns:
- `game_type`
- `result`

## Exploration 3: Game-Specific Quality
Use game events grouped by `game_type`:
- Quiz: answer select, finish, restart, AI explain usage
- Flashcards: classify mix, retries, pass complete
- Matching: attempts per completion
- Type In / Test: score bucket and finish rate
- Hungry Bug / Bug Match: crash vs complete rates

## Exploration 4: API Reliability
Use `api_request_result` with:
- `api_route`
- `result`
- `status_code`
- `duration_bucket`
- `provider`

Watch:
- error rate by route/provider
- latency distribution by route
- fallback frequency for `/api/generate`

## Operational Checks
- DebugView should show no events before consent.
- DebugView should show route + game events after consent.
- API reliability events should only appear with consent header `granted`.
