import './lib/trusted-types.ts'
import { mount } from 'svelte'
import App from './App.svelte'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-700.css'
import './app.css'

mount(App, { target: document.getElementById('app')! })
