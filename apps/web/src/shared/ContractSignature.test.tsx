import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContractSignature } from './ContractSignature.js';

function pad() {
  fireEvent.click(screen.getByRole('button', { name: '직접 쓰기' }));
  const element = screen.getByRole('img', { name: '서명 입력란' });
  Object.defineProperties(element, {
    setPointerCapture: { value: vi.fn() },
    hasPointerCapture: { value: vi.fn(() => true) },
    releasePointerCapture: {
      value: vi.fn(() => fireEvent.lostPointerCapture(element, { pointerId: 1 })),
    },
    getBoundingClientRect: { value: () => ({ left: 0, top: 0, width: 500, height: 250 }) },
  });
  return element;
}

describe('ContractSignature', () => {
  it('팝업에서 그린 획은 적용한 뒤에만 계약서 서명이 되고, 빠른 입력의 마지막 좌표도 보존한다', () => {
    const onReadyChange = vi.fn();
    render(
      <ContractSignature signerName="김서준" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    expect(screen.queryByRole('img', { name: '서명 입력란' })).not.toBeInTheDocument();
    const element = pad();
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerUp(element, { pointerId: 1, clientX: 20, clientY: 30 });
    expect(screen.getByRole('button', { name: '서명 적용' })).toBeDisabled();
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 20, clientY: 30 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 60, clientY: 50 });
    fireEvent.pointerUp(element, { pointerId: 1, clientX: 100, clientY: 70 });
    expect(element.querySelector('polyline')).toHaveAttribute('points', '40,60 120,100 200,140');
    expect(onReadyChange).not.toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '서명 적용' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    expect(
      screen.getByRole('button', { name: '서명 수정' }).querySelector('polyline'),
    ).toHaveAttribute('points', '40,60 120,100 200,140');
  });

  it('포인터 취소와 팝업 닫기는 미확정 서명을 계약서에 반영하지 않는다', () => {
    const onReadyChange = vi.fn();
    render(
      <ContractSignature signerName="김서준" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    const element = pad();
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(element, { pointerId: 1, clientX: 90, clientY: 60 });
    fireEvent.pointerCancel(element, { pointerId: 1 });
    expect(element.querySelector('polyline')).toBeNull();
    expect(screen.getByRole('button', { name: '서명 적용' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '서명창 닫기' }));
    expect(onReadyChange).not.toHaveBeenLastCalledWith(true);
  });

  it('이름 입력은 공백을 거부하며 수정 취소는 적용된 서명을 보존한다', () => {
    const onReadyChange = vi.fn();
    render(
      <ContractSignature signerName="김서준" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    expect(screen.getByRole('textbox', { name: '서명할 이름' })).toHaveValue('김서준');
    fireEvent.change(screen.getByRole('textbox', { name: '서명할 이름' }), {
      target: { value: '   ' },
    });
    expect(screen.getByRole('button', { name: '서명 적용' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: '서명할 이름' }), {
      target: { value: '박서준' },
    });
    fireEvent.click(screen.getByRole('button', { name: '서명 적용' }));
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '서명 수정' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 쓰기' }));
    fireEvent.click(screen.getByRole('button', { name: '서명창 닫기' }));
    expect(screen.getByRole('button', { name: '서명 수정' })).toHaveTextContent('박서준');
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
  });

  it('계약 조건이 바뀌면 적용된 서명과 열린 팝업을 폐기한다', () => {
    const onReadyChange = vi.fn();
    const { rerender } = render(
      <ContractSignature signerName="김서준" fingerprint="offer-a" onReadyChange={onReadyChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '이름 입력' }));
    fireEvent.click(screen.getByRole('button', { name: '서명 적용' }));
    fireEvent.click(screen.getByRole('button', { name: '서명 수정' }));
    rerender(
      <ContractSignature signerName="김서준" fingerprint="offer-b" onReadyChange={onReadyChange} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '서명 수정' })).not.toBeInTheDocument();
    expect(onReadyChange).toHaveBeenLastCalledWith(false);
  });
});
