import { createRoot } from 'react-dom/client';
import { App } from './App';
import { IllustratedApp } from './IllustratedApp';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import './illustrated.css';
const illustrated = new URLSearchParams(location.search).get('mode') === 'illustrated';
createRoot(document.getElementById('root')!).render(illustrated ? <IllustratedApp /> : <App />);
