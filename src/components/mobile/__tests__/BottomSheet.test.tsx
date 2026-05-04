import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BottomSheet } from '../BottomSheet';

describe('BottomSheet', () => {
  it('renders nothing when open=false', () => {
    render(
      <BottomSheet open={false} title="x" onRequestClose={() => undefined} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('renders backdrop + sheet + Save + Cancel when open=true', () => {
    render(
      <BottomSheet open={true} title="Status — #244" onRequestClose={() => undefined} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    expect(screen.getByTestId('bottom-sheet-backdrop')).toBeTruthy();
    expect(screen.getByTestId('bottom-sheet-handle')).toBeTruthy();
    expect(screen.getByTestId('bottom-sheet-cancel')).toBeTruthy();
    expect(screen.getByTestId('bottom-sheet-save')).toBeTruthy();
    expect(screen.getByText('Status — #244')).toBeTruthy();
  });

  it('Cancel button calls onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('bottom-sheet-cancel'));
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('Save button calls onSave', () => {
    const onSave = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={() => undefined} onSave={onSave}>
        body
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('bottom-sheet-save'));
    expect(onSave).toHaveBeenCalled();
  });

  it('Save button respects saveDisabled', () => {
    render(
      <BottomSheet open={true} title="x" onRequestClose={() => undefined} onSave={() => undefined} saveDisabled>
        body
      </BottomSheet>,
    );
    expect((screen.getByTestId('bottom-sheet-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('clicking the backdrop (not the sheet) calls onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    // Click on the backdrop element directly (target === currentTarget).
    const backdrop = screen.getByTestId('bottom-sheet-backdrop');
    fireEvent.click(backdrop, { target: backdrop });
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('clicking inside the sheet does NOT call onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        <div data-testid="sheet-body">body</div>
      </BottomSheet>,
    );
    fireEvent.click(screen.getByTestId('sheet-body'));
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('ESC key calls onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('drag-down past threshold calls onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    const handle = screen.getByTestId('bottom-sheet-handle');
    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 250 }); // dy = 150 > 80
    fireEvent.pointerUp(handle, { clientY: 250 });
    expect(onRequestClose).toHaveBeenCalled();
  });

  it('drag-down within threshold does NOT call onRequestClose', () => {
    const onRequestClose = vi.fn();
    render(
      <BottomSheet open={true} title="x" onRequestClose={onRequestClose} onSave={() => undefined}>
        body
      </BottomSheet>,
    );
    const handle = screen.getByTestId('bottom-sheet-handle');
    fireEvent.pointerDown(handle, { clientY: 100 });
    fireEvent.pointerMove(handle, { clientY: 150 }); // dy = 50 < 80
    fireEvent.pointerUp(handle, { clientY: 150 });
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
