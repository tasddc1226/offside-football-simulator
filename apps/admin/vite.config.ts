import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// T-11-572 운영 지표 대시보드(admin.offside-lab.com). 웹 게임과 배포 · 번들을 나눈다.
export default defineConfig({ plugins: [svelte()] });
