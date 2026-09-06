import "./style.css"
import { startGame } from "./src/game/game"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
 <main class="arcade">
   <header><a class="brand" href="./"><span class="brand-mark">影</span> SHADOW<span class="brand-light"> / </span>ARCHIVE</a><span class="edition">THE 8-BIT COLLECTION <span class="dot"></span> VOL. 002</span></header>
   <section class="heading"><div><div class="eyebrow">1988 SPIRIT. NEW BLOOD.</div><h1>SHADOW<span>OF THE</span> DRAGON</h1><p>A blade in the dark. A city on the edge.</p></div><div class="stage-label"><span>NOW PLAYING</span><strong>SHADOW PROVINCE — WORLD MAP</strong><small>EXPLORE / FIND THE TEMPLES</small></div></section>
   <section class="cabinet" aria-label="Shadow of the Dragon game">
     <div class="cabinet-bar"><span><i></i> ORIGINAL ARCADE MODE</span><div><button id="world-map" title="Return to world map (M)">WORLD MAP</button><button id="sound" title="Toggle sound">SOUND OFF</button><button id="fullscreen" title="Fullscreen">⛶ <span>FULLSCREEN</span></button></div></div>
     <div id="screen"><div id="game"></div><div class="scanlines"></div><div id="overlay" class="hidden"><div class="overlay-kicker">THE CITY HAS FALLEN. THE NIGHT IS YOURS.</div><h2>SHADOW<br><em>OF THE DRAGON</em></h2><div class="title-rule"></div><p>Cross the rooftops. Break the Black Lotus.<br>Leave nothing but a shadow.</p><button id="start">ENTER THE SHADOWS <span>→</span></button><small>PRESS ENTER TO START</small></div></div>
     <div class="cabinet-footer"><span><b>●</b> <span id="status">READY, PLAYER ONE</span></span><span>1 PLAYER <i>/</i> <span id="fps">— FPS</span> <i>/</i> PIXEL PERFECT</span></div>
   </section>
   <section class="below"><div class="controls"><span class="section-label">THE WAY OF THE NINJA</span><div class="keys"><div><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd><span>Move</span></div><div><kbd>Z</kbd><span>Jump</span></div><div><kbd>X</kbd><span>Slash</span></div><div><kbd>C</kbd><span>Shuriken</span></div><div><kbd>↑</kbd><span>Climb</span></div><div><kbd>ESC</kbd><span>Pause</span></div></div></div><div class="tip"><span class="section-label">SURVIVAL NOTE / 01</span><p>Walk into a temple to enter a stage.<br>Press M to return to the world map.</p></div></section>
   <div class="touch-controls"><button data-key="ArrowLeft">◀</button><button data-key="ArrowRight">▶</button><button data-key="ArrowUp">↑</button><button data-key="ArrowDown">↓</button><button data-key="KeyZ">JUMP</button><button data-key="KeyX">SLASH</button><button data-key="KeyC">✦</button></div>
   <footer><span>AN HOMAGE TO THE GOLDEN AGE OF NINJA ACTION.</span><span>NO SAVES. NO SHORTCUTS. JUST SKILL. <b>✦</b></span></footer>
 </main>`
startGame().catch((error: unknown) => {
  console.error(error)
  document.querySelector("#status")!.textContent =
    "Unable to start renderer. Please reload."
})
