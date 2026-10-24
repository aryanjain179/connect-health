/** Typed form-field helpers used by the record forms. */
import { useId } from 'react';
import { Field, inputClass } from '../ui';

interface Base {
  label: string;
  error?: string;
  hint?: string;
}

export function TextInput({ label, value, onChange, error, hint, type = 'text', placeholder, required }: Base & { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        className={inputClass}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function NumberInput({ label, value, onChange, error, hint, step = 'any', min, max }: Base & { value: number | null; onChange: (v: number | null) => void; step?: string; min?: number; max?: number }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint ?? 'Leave blank if not recorded.'} htmlFor={id}>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={inputClass}
        value={value ?? ''}
        step={step}
        min={min}
        max={max}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    </Field>
  );
}

export function SelectInput<T extends string>({ label, value, onChange, options, error, hint }: Base & { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <select id={id} className={inputClass} value={value} aria-invalid={!!error} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Yes / No / Not recorded – keeps "not recorded" distinct from "no". */
export function TriState({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const id = useId();
  const v = value === null ? 'unknown' : value ? 'yes' : 'no';
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className={inputClass} value={v} onChange={(e) => onChange(e.target.value === 'unknown' ? null : e.target.value === 'yes')}>
        <option value="unknown">Not recorded</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </Field>
  );
}

export function TextArea({ label, value, onChange, error, hint, rows = 3 }: Base & { value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <textarea id={id} rows={rows} className={inputClass} value={value} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/** Comma-separated list editor. */
export function ListInput({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  return (
    <TextInput
      label={label}
      hint={hint ?? 'Separate items with commas.'}
      value={value.join(', ')}
      onChange={(v) =>
        onChange(
          v
            .split(',')
            .map((x) => x.trim())
            .filter((x, i, arr) => x.length > 0 || i === arr.length - 1),
        )
      }
    />
  );
}

export function cleanList(xs: string[]): string[] {
  return xs.map((x) => x.trim()).filter(Boolean);
}
