import { Input } from '@/components/ui/Input';

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TopicInput({ value, onChange }: TopicInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="topic-input" className="block text-sm font-semibold">
        Topic prompt
      </label>
      <Input
        id="topic-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. AP Biology: Cellular Respiration"
      />
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        The model will generate a foundational set of terms and definitions from the topic alone.
      </p>
    </div>
  );
}
