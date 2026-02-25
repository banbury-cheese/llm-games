import { streamText } from 'ai';
import { NextResponse } from 'next/server';

import { buildChatSystemPrompt } from '@/lib/ai/prompts';
import { getLanguageModel } from '@/lib/ai/providers';
import { chatRequestSchema } from '@/lib/ai/schemas';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { terms, setTitle, tutorInstruction, messages, settings } = parsed.data;
    const system = buildChatSystemPrompt({ setTitle, terms, tutorInstruction });

    const result = streamText({
      model: getLanguageModel(settings),
      system,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected chat error.',
      },
      { status: 500 },
    );
  }
}
