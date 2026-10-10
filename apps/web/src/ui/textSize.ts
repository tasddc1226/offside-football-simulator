import { getTextSize, onTextSize, TEXT_SIZE_SCALE } from '@offside/app-core/textSize';

export function installTextSize() {
  const apply = () =>
    document.documentElement.style.setProperty(
      '--text-scale',
      String(TEXT_SIZE_SCALE[getTextSize()]),
    );
  apply();
  return onTextSize(apply);
}
