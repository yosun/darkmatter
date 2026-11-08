import { renderDarkmatter } from './darkmatter.ts';

document.title = 'DARKMATTER · The other 97%';
document.body.className = 'page-darkmatter';

const root = document.getElementById('app');
if (!root) throw new Error('DARKMATTER app root is missing.');
renderDarkmatter(root);
