import { mount } from 'svelte';

import App from './App.svelte';
import { applyTheme, storedTheme } from './lib/theme.svelte';
import './app.css';
// Keyed off [data-theme], so it costs the other five themes nothing but its bytes.
import './styles/millennium.css';

// Before the first paint, so a non-default theme never flashes the default one.
applyTheme(storedTheme());

const target = document.getElementById('app');
if (target === null) {
  throw new Error('Missing #app mount point in index.html');
}

export default mount(App, { target });
