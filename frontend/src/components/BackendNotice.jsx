import { ServerOff } from 'lucide-react';

export default function BackendNotice({ title = 'Backend required', children }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
      <ServerOff className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-900">{title}</p>
        <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
