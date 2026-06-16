type ClassValue = string | number | false | null | undefined | Record<string, boolean>;

export function cn(...inputs: ClassValue[]) {
  const tokens = inputs
    .flatMap((input) => {
      if (!input) return [];
      if (typeof input === 'string' || typeof input === 'number') return String(input).split(/\s+/);
      return Object.entries(input)
        .filter(([, enabled]) => enabled)
        .flatMap(([className]) => className.split(/\s+/));
    })
    .filter(Boolean);

  return Array.from(new Set(tokens)).join(' ');
}
