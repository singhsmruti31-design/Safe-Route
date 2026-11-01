import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Loader2, Crosshair } from 'lucide-react';
import { searchLocation } from '../services/geocoding.js';
import { SEARCH_DEBOUNCE_MS } from '../data/scoringWeights.js';

/**
 * Location search box with real Nominatim autocomplete.
 *
 * Props:
 *   placeholder     string
 *   value           { displayName, lat, lon } | null
 *   onChange        (location) => void
 *   onUseCurrentLocation  () => void   (optional)
 *   label           string
 *   icon            React component (Lucide icon)
 *   disabled        boolean
 */
export default function SearchBox({
  placeholder = 'Search location…',
  value,
  onChange,
  onUseCurrentLocation,
  label,
  icon: Icon = Search,
  disabled = false,
}) {
  const [inputText, setInputText] = useState(value?.shortName || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Update input when value changes externally
  useEffect(() => {
    if (value) {
      setInputText(value.shortName || value.displayName || '');
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInput = useCallback((e) => {
    const text = e.target.value;
    setInputText(text);
    setError(null);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchLocation(text, { countrycodes: 'in', limit: 6 });
        setSuggestions(results);
        setShowSuggestions(true);
      } catch (err) {
        setError('Search failed. Please try again.');
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const handleSelect = (location) => {
    setInputText(location.shortName || location.displayName);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(location);
  };

  const handleClear = () => {
    setInputText('');
    setSuggestions([]);
    setShowSuggestions(false);
    onChange(null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">
          {label}
        </label>
      )}
      <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2.5 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-blue-100'
      } border-border`}>
        <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          type="text"
          value={inputText}
          onChange={handleInput}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-text-dark text-sm outline-none placeholder-text-muted min-w-0"
          autoComplete="off"
          aria-autocomplete="list"
          aria-label={label || placeholder}
        />
        {loading && <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
        {!loading && inputText && (
          <button onClick={handleClear} className="text-text-muted hover:text-text-dark flex-shrink-0" aria-label="Clear">
            <X className="w-4 h-4" />
          </button>
        )}
        {onUseCurrentLocation && !loading && (
          <button
            onClick={onUseCurrentLocation}
            title="Use my current location"
            className="text-primary hover:text-blue-700 flex-shrink-0"
            aria-label="Use current location"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelect(s)}
              className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-border last:border-0"
            >
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-dark truncate">{s.shortName}</p>
                <p className="text-xs text-text-muted truncate">{s.displayName}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && !loading && inputText.length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-sm px-3 py-2.5 text-sm text-text-muted animate-fade-in">
          No locations found. Try a different search.
        </div>
      )}
    </div>
  );
}
