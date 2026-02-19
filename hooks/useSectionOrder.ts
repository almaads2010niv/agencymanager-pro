import { useState, useCallback } from 'react';

/**
 * Hook for managing drag-and-drop section order in profile pages.
 * Persists order to localStorage per profile type.
 */
export function useSectionOrder(profileType: 'client' | 'lead', defaultOrder: string[]) {
  const storageKey = `amp_section_order_${profileType}`;

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge: keep stored order but add any new sections at the end
          const merged = [...parsed.filter((id: string) => defaultOrder.includes(id))];
          for (const id of defaultOrder) {
            if (!merged.includes(id)) merged.push(id);
          }
          return merged;
        }
      }
    } catch { /* ignore */ }
    return defaultOrder;
  });

  const setOrder = useCallback((newOrder: string[]) => {
    setSectionOrder(newOrder);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newOrder));
    } catch { /* ignore */ }
  }, [storageKey]);

  const resetOrder = useCallback(() => {
    setSectionOrder(defaultOrder);
    try {
      localStorage.removeItem(storageKey);
    } catch { /* ignore */ }
  }, [defaultOrder, storageKey]);

  const getOrder = useCallback((sectionId: string) => {
    const idx = sectionOrder.indexOf(sectionId);
    return idx === -1 ? 999 : idx;
  }, [sectionOrder]);

  return { sectionOrder, setOrder, resetOrder, getOrder };
}
