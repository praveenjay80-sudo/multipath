import { useState, useCallback } from 'react';
import { getSubfields, getSubSubfields } from '../constants/academicTaxonomy';

export function useFieldNavigation() {
  const [expandedFields, setExpandedFields] = useState(new Set());
  const [expandedSubfields, setExpandedSubfields] = useState(new Set());

  const clickTopLevel = useCallback((field) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) { next.delete(field); } else { next.add(field); }
      return next;
    });
  }, []);

  const clickSubfield = useCallback((parent, subfield) => {
    const key = `${parent}::${subfield}`;
    setExpandedSubfields(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }, []);

  const isFieldExpanded = useCallback((field) => expandedFields.has(field), [expandedFields]);
  const isSubfieldExpanded = useCallback((key) => expandedSubfields.has(key), [expandedSubfields]);

  const clear = useCallback(() => {
    setExpandedFields(new Set());
    setExpandedSubfields(new Set());
  }, []);

  return { clickTopLevel, clickSubfield, isFieldExpanded, isSubfieldExpanded, getSubfields, getSubSubfields, clear };
}
