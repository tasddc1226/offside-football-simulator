import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTrigger } from './Dialog.js';

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
});
