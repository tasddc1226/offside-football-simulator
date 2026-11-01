// T-11-600 라운지 필드 입구. 필드는 Skia(네이티브)로 그려서 1.1.6 이후 스토어 빌드에만 있다.
// 1.1.5 · 1.1.4 빌드로 보내는 OTA는 .github/scripts/prepare-ota-legacy.mjs가 이 파일을 null로 바꿔 Skia 없이 묶는다.
import { LoungeField as Field } from './LoungeField';

export const LoungeField: typeof Field | null = Field;
