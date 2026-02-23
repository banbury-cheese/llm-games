import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function CreatePlaceholderPage() {
  return (
    <Card className="mx-auto max-w-3xl rounded-[28px] p-6 sm:p-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Create Flow (Phase 3)</h1>
        <p className="text-sm leading-6 text-[var(--text-muted)] sm:text-base">
          This page will support text, PDF, and topic input with LLM term extraction and editable term review.
        </p>
        <Link href="/">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    </Card>
  );
}
