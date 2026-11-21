declare module '*.md' {
  const text: string;
  export default text;
}

// 테스트가 다른 패키지 소스(apps/api/src/db/schema.ts)를 글자로 읽는다(Vite ?raw).
declare module '*?raw' {
  const text: string;
  export default text;
}
