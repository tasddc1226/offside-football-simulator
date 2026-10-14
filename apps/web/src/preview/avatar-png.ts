import { mount } from 'svelte';
import '../style.css';
import AvatarPngPreview from './AvatarPngPreview.svelte';

// Dedicated local review entry: no app boot, analytics, accounts, API or save writes.
if (import.meta.env.DEV)
  mount(AvatarPngPreview, { target: document.getElementById('png-preview')! });
