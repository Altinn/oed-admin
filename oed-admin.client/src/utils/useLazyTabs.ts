import { useCallback, useState } from "react";

/**
 * Designsystemet's Tabs.Panel renders its children even while hidden, so every tab's queries
 * fire on page load. Gate panel content on isVisited(tab): a tab mounts the first time it is
 * selected and then stays mounted, keeping its local state and avoiding refetches on return.
 */
export function useLazyTabs(defaultValue: string) {
  const [value, setValue] = useState(defaultValue);
  const [visited, setVisited] = useState(() => new Set([defaultValue]));

  const onChange = useCallback((next: string) => {
    setValue(next);
    setVisited((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);

  const isVisited = useCallback((tab: string) => visited.has(tab), [visited]);

  return { value, onChange, isVisited };
}
