import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContractSignature } from './ContractSignature.js';

function installPointerCapture(element: Element) {
  Object.defineProperties(element, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn(() => true) },
    releasePointerCapture: { value: vi.fn() },
    getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 500, height: 120 }) },
  });
}

describe('ContractSignature', () => {
  it('빈 값과 점 입력은 서명으로 인정하지 않고, 획을 그리면 준비된다', () => {
    const onReadyChange = vi.fn();
    render(
      <ContractSignature signerName="김서준" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    const pad = screen.getByRole('img', { name: '서명 입력란' });
    installPointerCapture(pad);
    fireEvent.pointerDown(pad, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(pad, { pointerId: 1, clientX: 10, clientY: 10 });
    expect(onReadyChange).not.toHaveBeenLastCalledWith(true);

    fireEvent.pointerDown(pad, { pointerId: 2, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(pad, { pointerId: 2, clientX: 80, clientY: 35 });
    fireEvent.pointerMove(pad, { pointerId: 2, clientX: 160, clientY: 55 });
    fireEvent.pointerUp(pad, { pointerId: 2, clientX: 160, clientY: 55 });
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: '다시 쓰기' }));
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });

  it('이슈 157: 안내 문구는 모드별로 갈린다(이름 입력 모드에 캔버스 안내가 남지 않는다)', () => {
    render(<ContractSignature signerName="김서준" fingerprint="offer-e" onReadyChange={vi.fn()} />);
    expect(screen.getByText(/손가락이나 마우스로 쓰세요/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    expect(screen.queryByText(/손가락이나 마우스로 쓰세요/)).not.toBeInTheDocument();
    expect(screen.getByText(/입력한 이름이 서명으로 남습니다/)).toBeInTheDocument();
  });

  it('키보드 이름 입력은 공백을 거부하고 조건 fingerprint 변경 시 폐기한다', () => {
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <ContractSignature signerName="" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    const input = screen.getByRole('textbox', { name: '서명할 이름' });
    fireEvent.change(input, { target: { value: '   ' } });
    expect(onReadyChange).not.toHaveBeenLastCalledWith(true);
    fireEvent.change(input, { target: { value: '김서준' } });
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    rerender(
      <ContractSignature signerName="" fingerprint="offer-b" onReadyChange={onReadyChange} />,
    );
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('textbox', { name: '서명할 이름' })).toHaveValue('');
  });

  it('이름 입력 모드는 signerName으로 프리필되어 바로 서명 가능하고, 비우면 비활성화된다', () => {
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <ContractSignature signerName="김서준" fingerprint="offer-c" onReadyChange={onReadyChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    const input = screen.getByRole('textbox', { name: '서명할 이름' });
    expect(input).toHaveValue('김서준');
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    fireEvent.change(input, { target: { value: '' } });
    expect(onReadyChange).toHaveBeenLastCalledWith(false);

    fireEvent.change(input, { target: { value: '박서준' } });
    expect(input).toHaveValue('박서준');
    expect(onReadyChange).toHaveBeenLastCalledWith(true);

    rerender(
      <ContractSignature signerName="이수민" fingerprint="offer-d" onReadyChange={onReadyChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    expect(screen.getByRole('textbox', { name: '서명할 이름' })).toHaveValue('이수민');
  });
});
