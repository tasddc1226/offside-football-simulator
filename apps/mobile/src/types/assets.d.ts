// Metro가 이미지 import를 에셋 번호로 바꾼다(Image source에 그대로 넣는다).
declare module '*.png' {
  const asset: number;
  export default asset;
}
