<script lang="ts">
  import { DC_GALLERY_URL } from '@offside/app-core/links';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';
</script>

<!-- 문의·SNS 링크 푸터 — 홈과 설정 화면 맨 아래에 같은 모양으로 둔다. -->
<footer class="site-foot">
  <p>{L.footContact} <a href="mailto:contact@offside-lab.com">contact@offside-lab.com</a></p>
  <p>
    Instagram <a href="https://www.instagram.com/offside.lab.kr/" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a>
    · Threads <a href="https://www.threads.com/@offside.lab.kr" target="_blank" rel="noopener noreferrer">@offside.lab.kr</a>
  </p>
  <p>{L.footCommunity} <a href={DC_GALLERY_URL} target="_blank" rel="noopener noreferrer">{L.footGallery}</a></p>
</footer>
