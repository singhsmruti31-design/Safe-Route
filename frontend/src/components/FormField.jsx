export default function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  required = false,
  hint,
}) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={`w-full border rounded-xl px-3 py-2.5 text-sm text-text-dark outline-none bg-white ${
          error ? 'border-danger' : 'border-border focus:border-primary focus:ring-2 focus:ring-blue-100'
        }`}
      />
      {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
