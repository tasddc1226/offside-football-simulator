// T-11-841 화면 안쪽 컴포넌트가 화면 아래 고정 줄(Screen footer)에 내용을 올리는 자리. 화면이 Provider로 setter를 넘기고,
// 안쪽은 useFooterSlot으로 그릴 내용을 넣는다. Provider가 없으면 null을 받아 제자리에 그린다.
import { createContext, useContext, type ReactNode } from 'react';

export const FooterSlot = createContext<((node: ReactNode) => void) | null>(null);
export const useFooterSlot = () => useContext(FooterSlot);
