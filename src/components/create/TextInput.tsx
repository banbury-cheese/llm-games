import { TextArea } from '@/components/ui/TextArea';

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ value, onChange }: TextInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="source-text" className="block text-sm font-semibold">
        Paste study content
      </label>
      <TextArea
        id="source-text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste lecture notes, article text, textbook excerpts, or class summaries..."
        className="min-h-[220px]"
      />
      <p className="text-xs text-[var(--text-muted)]">
        Tip: include headings or bullet points. The extractor works best with structured text.
      </p>
    </div>
  );
}
