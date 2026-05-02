import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { useStore } from '../state/store';
import type { ItemId } from '../types';
import { strings } from '../strings';

export interface DescriptionCellProps {
  itemId: ItemId;
  text: string;
}

export function DescriptionCell({ itemId, text }: DescriptionCellProps): JSX.Element {
  const { view, setView } = useStore();
  const [autoExpanded, setAutoExpanded] = useState(false);
  const expanded = view.expandAllDescriptions || view.expandedRows.has(itemId) || autoExpanded;

  // Auto-expand when the free-text filter would match inside the description.
  useEffect(() => {
    const ft = view.freeText.trim();
    if (ft.length === 0) {
      setAutoExpanded(false);
      return;
    }
    const haystack = text.toLowerCase();
    const matches = haystack.includes(ft.toLowerCase());
    setAutoExpanded(matches);
  }, [view.freeText, text]);

  const toggle = (): void => {
    setView((v) => {
      const next = new Set(v.expandedRows);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return { ...v, expandedRows: next };
    });
  };

  const className = expanded ? 'description-cell expanded' : 'description-cell collapsed';

  return (
    <div className={className} data-testid={`desc-${itemId}`}>
      <button
        className="expand-toggle"
        onClick={toggle}
        aria-label={expanded ? strings.description.collapse : strings.description.expand}
        aria-expanded={expanded}
      >
        {expanded ? '▾' : '▸'}
      </button>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: 'span' }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
