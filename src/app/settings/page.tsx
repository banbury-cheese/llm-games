import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function SettingsPlaceholderPage() {
  return (
    <Card className="mx-auto max-w-3xl rounded-[28px] p-6 sm:p-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">AI Settings (Phase 2)</h1>
        <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          Configure OpenAI, Anthropic, or Google model + API key stored locally for this MVP.
        </p>
        <Link href="/">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    </Card>
  );
}
