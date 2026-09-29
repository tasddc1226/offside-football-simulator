/** HTML·SVG 문자열에 넣을 글자 이스케이프(속성값 포함). 워커의 공유 메타·카드가 함께 쓴다. */
export const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
