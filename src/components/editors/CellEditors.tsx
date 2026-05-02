/**
 * Context-sensitive cell editors. Each editor is a controlled component that
 * emits the new value to a callback; the caller is responsible for staging
 * the resulting PendingEdit.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  COMPLEXITY_VALUES,
  EDITABLE_STATUS_VALUES,
  type Complexity,
  type Epic,
  type ScoreCell,
  type Status,
} from '../../types';
import { strings } from '../../strings';

export interface EditorCommonProps<T> {
  value: T;
  onChange: (next: T) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}

function useEscapeAndAutofocus<T extends HTMLElement>(
  onCancel: () => void,
  autoFocus: boolean | undefined,
): React.RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return ref;
}

export function StatusDropdown(props: EditorCommonProps<Status>): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLSelectElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <select
        ref={ref}
        aria-label="Status"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as Status)}
      >
        {EDITABLE_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ComplexityDropdown(props: EditorCommonProps<Complexity>): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLSelectElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <select
        ref={ref}
        aria-label="Complexity"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as Complexity)}
      >
        {COMPLEXITY_VALUES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </span>
  );
}

const SCORE_OPTIONS: ScoreCell[] = ['-', 1, 3, 5];
export function ScorePicker(props: EditorCommonProps<ScoreCell>): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLSelectElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <select
        ref={ref}
        aria-label="Score"
        value={String(props.value)}
        onChange={(e) => {
          const v = e.target.value;
          props.onChange(v === '-' ? '-' : (Number.parseInt(v, 10) as 1 | 3 | 5));
        }}
      >
        {SCORE_OPTIONS.map((s) => (
          <option key={String(s)} value={String(s)}>
            {String(s)}
          </option>
        ))}
      </select>
    </span>
  );
}

export interface EpicPickerProps extends EditorCommonProps<string> {
  epics: Epic[];
}
export function EpicPicker(props: EpicPickerProps): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLSelectElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <select
        ref={ref}
        aria-label="Epic"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">{strings.filters.none}</option>
        {props.epics.map((e) => (
          <option key={e.id} value={e.id}>
            {e.id}
          </option>
        ))}
      </select>
    </span>
  );
}

export interface CategoryComboBoxProps extends EditorCommonProps<string> {
  categories: string[];
}
export function CategoryComboBox(props: CategoryComboBoxProps): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLInputElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <input
        ref={ref}
        aria-label="Category"
        list="category-list"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <datalist id="category-list">
        {props.categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </span>
  );
}

export function DateInput(props: EditorCommonProps<string>): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLInputElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <input
        ref={ref}
        type="date"
        aria-label="Date"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </span>
  );
}

export interface IdInputProps extends EditorCommonProps<number> {
  collisionWarning: boolean;
}
export function IdInput(props: IdInputProps): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLInputElement>(props.onCancel, props.autoFocus);
  const [text, setText] = useState(String(props.value));
  return (
    <span className="cell-editor">
      <input
        ref={ref}
        aria-label="Item ID"
        type="number"
        min={1}
        max={9999}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(n)) props.onChange(n);
        }}
      />
      {props.collisionWarning ? (
        <span className="banner error" style={{ display: 'inline-block', marginLeft: 4, padding: '0 4px' }}>
          collision
        </span>
      ) : null}
    </span>
  );
}

export function DescriptionTextarea(props: EditorCommonProps<string>): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLTextAreaElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <textarea
        ref={ref}
        aria-label="Description"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        rows={4}
        style={{ width: '100%' }}
      />
    </span>
  );
}

export interface TextInputProps extends EditorCommonProps<string> {
  ariaLabel: string;
}
export function TextInput(props: TextInputProps): JSX.Element {
  const ref = useEscapeAndAutofocus<HTMLInputElement>(props.onCancel, props.autoFocus);
  return (
    <span className="cell-editor">
      <input
        ref={ref}
        type="text"
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </span>
  );
}
