/**
 * Per-editor controlled-component contract tests:
 * - Renders the value prop verbatim
 * - Calls onChange with the new value
 * - Calls onCancel on Escape
 * - Surfaces an aria-label so screen readers can identify the field
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  StatusDropdown,
  ComplexityDropdown,
  ScorePicker,
  EpicPicker,
  CategoryComboBox,
  DateInput,
  IdInput,
  DescriptionTextarea,
  TextInput,
} from '../CellEditors';
import type { Epic } from '../../../types';

const noop = (): void => undefined;
const epics: Epic[] = [
  { id: 'E01' as Epic['id'], title: 'First', description: '', status: 'approved' },
  { id: 'E02' as Epic['id'], title: 'Second', description: '', status: 'complete' },
];

describe('StatusDropdown', () => {
  it('renders the current value and emits onChange', () => {
    const onChange = vi.fn();
    render(<StatusDropdown value="proposed" onChange={onChange} onCancel={noop} />);
    const select = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(select.value).toBe('proposed');
    fireEvent.change(select, { target: { value: 'approved' } });
    expect(onChange).toHaveBeenCalledWith('approved');
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(<StatusDropdown value="proposed" onChange={noop} onCancel={onCancel} autoFocus />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('does NOT include parked or rejected in the option list', () => {
    render(<StatusDropdown value="proposed" onChange={noop} onCancel={noop} />);
    const options = Array.from(
      (screen.getByLabelText('Status') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).not.toContain('parked');
    expect(options).not.toContain('rejected');
  });
});

describe('ComplexityDropdown', () => {
  it('renders Low / Medium / High', () => {
    render(<ComplexityDropdown value="Medium" onChange={noop} onCancel={noop} />);
    const options = Array.from(
      (screen.getByLabelText('Complexity') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(['Low', 'Medium', 'High']);
  });
});

describe('ScorePicker', () => {
  it('emits the dash sentinel when "-" is picked', () => {
    const onChange = vi.fn();
    render(<ScorePicker value={3} onChange={onChange} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText('Score'), { target: { value: '-' } });
    expect(onChange).toHaveBeenCalledWith('-');
  });

  it('emits a numeric score when a digit is picked', () => {
    const onChange = vi.fn();
    render(<ScorePicker value="-" onChange={onChange} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText('Score'), { target: { value: '5' } });
    expect(onChange).toHaveBeenCalledWith(5);
  });
});

describe('EpicPicker', () => {
  it('lists every epic + the (none) sentinel', () => {
    render(<EpicPicker value="" epics={epics} onChange={noop} onCancel={noop} />);
    const options = Array.from(
      (screen.getByLabelText('Epic') as HTMLSelectElement).options,
    ).map((o) => o.value);
    expect(options).toEqual(['', 'E01', 'E02']);
  });

  it('emits the empty string when (none) is picked', () => {
    const onChange = vi.fn();
    render(<EpicPicker value="E01" epics={epics} onChange={onChange} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText('Epic'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('CategoryComboBox', () => {
  it('uses a datalist for existing categories + free-text fallback', () => {
    render(
      <CategoryComboBox
        value="Feature"
        categories={['Feature', 'Bug']}
        onChange={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByLabelText('Category').getAttribute('list')).toBe('category-list');
  });
});

describe('DateInput', () => {
  it('renders an aria-labelled date input', () => {
    render(<DateInput value="2026-05-02" onChange={noop} onCancel={noop} />);
    const input = screen.getByLabelText('Date') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2026-05-02');
  });
});

describe('IdInput', () => {
  it('emits the parsed integer on change', () => {
    const onChange = vi.fn();
    render(
      <IdInput value={42} onChange={onChange} onCancel={noop} collisionWarning={false} />,
    );
    fireEvent.change(screen.getByLabelText('Item ID'), { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(99);
  });

  it('renders a collision warning badge when prop is true', () => {
    render(<IdInput value={42} onChange={noop} onCancel={noop} collisionWarning />);
    expect(screen.getByText('collision')).toBeTruthy();
  });
});

describe('DescriptionTextarea', () => {
  it('emits onChange with the new value', () => {
    const onChange = vi.fn();
    render(<DescriptionTextarea value="hello" onChange={onChange} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'world' } });
    expect(onChange).toHaveBeenCalledWith('world');
  });
});

describe('TextInput', () => {
  it('uses the provided ariaLabel', () => {
    render(
      <TextInput value="x" ariaLabel="My Field" onChange={noop} onCancel={noop} />,
    );
    expect(screen.getByLabelText('My Field')).toBeTruthy();
  });
});
