import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTrigger, SheetContent } from './Dialog.js';

function TestDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>열기</DialogTrigger>
      <DialogContent title="확인" description="정말 진행합니까" closeLabel="닫기">
        <button type="button">확정</button>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders title and description when open', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByRole('button', { name: '열기' }));

    expect(screen.getByRole('dialog', { name: '확인' })).toBeInTheDocument();
    expect(screen.getByText('정말 진행합니까')).toBeInTheDocument();
  });

  it('moves focus inside the dialog when opened', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByRole('button', { name: '열기' }));

    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    const trigger = screen.getByRole('button', { name: '열기' });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('has an accessible close button', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByRole('button', { name: '열기' }));
    expect(screen.getByRole('button', { name: '닫기' })).toBeInTheDocument();
  });

  it('exposes the same modal motion hooks for the content and backdrop', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    await user.click(screen.getByRole('button', { name: '열기' }));

    const backdrop = document.querySelector('.os-dialog-overlay');
    expect(backdrop).toHaveAttribute('data-state', 'open');
    expect(backdrop).not.toHaveClass('bg-os-text/50');
    expect(screen.getByRole('dialog')).toHaveClass('os-dialog');
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open');
  });

  it('dismisses from the backdrop and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    const trigger = screen.getByRole('button', { name: '열기' });
    await user.click(trigger);
    const backdrop = document.querySelector<HTMLElement>('.os-dialog-overlay');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.os-dialog-overlay')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps keyboard focus trapped and supports reopening after dismissal', async () => {
    const user = userEvent.setup();
    render(<TestDialog />);

    const trigger = screen.getByRole('button', { name: '열기' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: '확정' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: '확정' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(trigger);

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.querySelectorAll('.os-dialog-overlay')).toHaveLength(1);
    expect(screen.getByRole('button', { name: '확정' })).toHaveFocus();
  });
});

function TestSheet() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>열기</DialogTrigger>
      <SheetContent title="이용약관" closeLabel="닫기">
        <p>본문</p>
      </SheetContent>
    </Dialog>
  );
}

describe('SheetContent', () => {
  it('role=dialog로 열리고 제목이 접근성 이름이 된다', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    await user.click(screen.getByRole('button', { name: '열기' }));

    const dialog = screen.getByRole('dialog', { name: '이용약관' });
    expect(dialog).toHaveClass('os-sheet');
    expect(dialog).toContainElement(screen.getByText('본문'));
  });

  it('닫기 버튼으로 닫히고 트리거로 포커스가 돌아온다', async () => {
    const user = userEvent.setup();
    render(<TestSheet />);

    const trigger = screen.getByRole('button', { name: '열기' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '닫기' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
