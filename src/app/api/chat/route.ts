import { streamText } from 'ai';
import { NextResponse } from 'next/server';

import { getAnalyticsHeaders, trackServerApiRequest } from '@/lib/analytics/server';
import { buildChatSystemPrompt } from '@/lib/ai/prompts';
import { getLanguageModel } from '@/lib/ai/providers';
import { chatRequestSchema } from '@/lib/ai/schemas';

export async function POST(request: Request) {
  const startedAt = Date.now();
  const analytics = getAnalyticsHeaders(request);
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      await trackServerApiRequest({
        clientId: analytics.clientId,
        consent: analytics.consent,
        apiRoute: '/api/chat',
        result: 'error',
        statusCode: 400,
        durationMs: Date.now() - startedAt,
        errorCode: 'bad_request',
      });
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { terms, setTitle, tutorInstruction, messages, settings } = parsed.data;
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/chat',
      provider: settings.provider,
      result: 'start',
    });
    const system = buildChatSystemPrompt({ setTitle, terms, tutorInstruction });

    const result = streamText({
      model: getLanguageModel(settings),
      system,
      messages,
    });

    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/chat',
      provider: settings.provider,
      result: 'success',
      statusCode: 200,
      durationMs: Date.now() - startedAt,
    });
    return result.toTextStreamResponse();
  } catch (error) {
    const response = NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected chat error.',
      },
      { status: 500 },
    );
    await trackServerApiRequest({
      clientId: analytics.clientId,
      consent: analytics.consent,
      apiRoute: '/api/chat',
      result: 'error',
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : 'unexpected_error',
    });
    return response;
  }
}
