import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './Tabs.js';

function renderTabs() {
  return render(
    <Tabs defaultValue="schedule">
      <TabsList aria-label="대시보드 구역">
        <TabsTrigger value="schedule">일정표</TabsTrigger>
        <TabsTrigger value="locker">라커룸</TabsTrigger>
      </TabsList>
      <TabsContent value="schedule">일정표 내용</TabsContent>
      <TabsContent value="locker">라커룸 내용</TabsContent>
    </Tabs>,
  );
}

describe('Tabs', () => {
  it('shows the default tab content', () => {
    renderTabs();
    expect(screen.getByText('일정표 내용')).toBeVisible();
    expect(screen.queryByText('라커룸 내용')).not.toBeInTheDocument();
  });

  it('switches tabs with arrow keys and activates on selection', async () => {
    const user = userEvent.setup();
    renderTabs();

    screen.getByRole('tab', { name: '일정표' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: '라커룸' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('라커룸 내용')).toBeVisible();
  });

  it('has a 44px minimum touch target on triggers', () => {
    renderTabs();
    expect(screen.getByRole('tab', { name: '일정표' })).toHaveStyle({ minHeight: 'var(--os-touch-min)' });
  });
});
