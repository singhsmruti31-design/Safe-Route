import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Password',
  autoComplete = 'current-password',
  error,
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className={`flex items-center border rounded-xl bg-white px-3 ${error ? 'border-danger' : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100'}`}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="flex-1 py-2.5 text-sm text-text-dark outline-none bg-transparent min-w-0"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="p-2 text-text-muted hover:text-text-dark"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
