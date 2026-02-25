import { render } from 'solid-js/web'
import './style.css'
import { App } from './app'

const root = document.getElementById('root')

if (root) {
  render(() => <App />, root)
}
