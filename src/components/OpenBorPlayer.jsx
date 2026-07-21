import { useEffect, useState, useRef } from 'react';
import { downloadAndMountPak } from '../services/ArchiveOrgService';
import './OpenBorPlayer.css';

const OpenBorPlayer = ({ game, onExit }) => {
  const [loadState, setLoadState] = useState({ status: 'init', message: 'Initializing...', progress: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const initEngine = async () => {
      try {
        // Step 0: Hide Gamepads from Emscripten so it defaults to Keyboard for Player 1
        if (!window.originalGetGamepads && navigator.getGamepads) {
          window.originalGetGamepads = navigator.getGamepads.bind(navigator);
          navigator.getGamepads = () => [];
        }

        // Step 1: Initialize window.myGame for the OpenBOR loader
        const contentPath = '/openbor/';
        window.myGame = {
          canvas: document.getElementById('canvas'),
          LoadingOverlay: document.getElementById('loading-overlay'),
          overlay: document.getElementById('overlay'),
          buttonsOverlay: document.getElementById('buttons-overlay'),
          contentPath: contentPath,
          baseWidth: 320,
          baseHeight: 240,
          assetType: 'custom',
          paths: {
            assetsPaths: [], // We handle downloading ourselves to bypass ZIP requirement
            'OpenBOR.zip': contentPath + 'OpenBOR.zip',
            'game.css': contentPath + 'game.css?v=' + Date.now(),
            'main.js': contentPath + 'main.js?v=' + Date.now(),
            'mobile.js': contentPath + 'mobile.js?v=' + Date.now(),
            'buttons.zip': contentPath + 'buttons.zip',
            'fflate.min.js': contentPath + 'fflate.min.js?v=' + Date.now(),
            'nipplejs.min.js': contentPath + 'nipplejs.min.js?v=' + Date.now(),
          }
        };
        window.myGame.canvas.width = window.myGame.baseWidth;
        window.myGame.canvas.height = window.myGame.baseHeight;

        // Step 2: Set the custom asset loader to handle the download before engine start
        window.myGame.onCustomAssetLoader = () => {
          return downloadAndMountPak(game.pakUrl, (state) => {
            if (isMounted) setLoadState(state);
          });
        };

        // Step 3: Inject main.js to load the WASM environment
        const script = document.createElement('script');
        script.src = window.myGame.paths['main.js'];
        script.async = true;
        document.body.appendChild(script);

      } catch (error) {
        if (isMounted) setLoadState({ status: 'error', message: error.message, progress: 0 });
      }
    };

    initEngine();

    return () => {
      isMounted = false;
      if (window.originalGetGamepads) {
        navigator.getGamepads = window.originalGetGamepads;
        delete window.originalGetGamepads;
      }
      if (window.Module && window.Module.pauseMainLoop) {
         window.Module.pauseMainLoop();
      }
    };
  }, [game]);

  // Gamepad Shortcuts Polling
  useEffect(() => {
    let animationFrameId;
    let lastShortcutTime = 0;
    
    // Store previous button states to detect keydown/keyup
    // We track: 0(A), 1(B), 2(X), 3(Y)
    const prevButtonState = { 0: false, 1: false, 2: false, 3: false };
    
    // Map gamepad buttons to the keyboard keys OpenBOR uses
    // A -> Jump(D), X -> Attack(A), Y -> Special(S), B -> Star(F)
    const buttonToKeyMap = {
      0: { key: 'd', code: 'KeyD', keyCode: 68 }, // A = Jump
      1: { key: 'f', code: 'KeyF', keyCode: 70 }, // B = Star
      2: { key: 'a', code: 'KeyA', keyCode: 65 }, // X = Attack
      3: { key: 's', code: 'KeyS', keyCode: 83 }  // Y = Special
    };

    const triggerKey = (keyConfig, isDown) => {
      const canvas = document.getElementById('canvas');
      if (canvas) {
        const eventType = isDown ? 'keydown' : 'keyup';
        const event = new KeyboardEvent(eventType, { 
          key: keyConfig.key, 
          code: keyConfig.code, 
          bubbles: true,
          cancelable: true
        });
        // Emscripten strictly requires keyCode and which, but they are read-only on KeyboardEvent
        Object.defineProperty(event, 'keyCode', { get: () => keyConfig.keyCode });
        Object.defineProperty(event, 'which', { get: () => keyConfig.keyCode });
        canvas.dispatchEvent(event);
      }
    };

    const simulateStart = () => {
      triggerKey({ key: 'Enter', code: 'Enter', keyCode: 13 }, true);
      setTimeout(() => {
        triggerKey({ key: 'Enter', code: 'Enter', keyCode: 13 }, false);
      }, 100);
    };

    const pollGamepads = () => {
      // Use originalGetGamepads since we overrode navigator.getGamepads for Emscripten
      const getPads = window.originalGetGamepads || (navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => []);
      const gamepads = getPads();
      const now = Date.now();
      
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp) {
          
          // Map D-pad and Action Buttons
          // 0(A), 1(B), 2(X), 3(Y)
          // 12(Up), 13(Down), 14(Left), 15(Right)
          const allMappedButtons = [0, 1, 2, 3, 12, 13, 14, 15];
          
          // Extend button map for D-pad
          buttonToKeyMap[12] = { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 };
          buttonToKeyMap[13] = { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 };
          buttonToKeyMap[14] = { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 };
          buttonToKeyMap[15] = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 };

          allMappedButtons.forEach(btnIndex => {
            const isPressed = gp.buttons[btnIndex]?.pressed;
            if (isPressed && !prevButtonState[btnIndex]) {
              prevButtonState[btnIndex] = true;
              triggerKey(buttonToKeyMap[btnIndex], true);
            } else if (!isPressed && prevButtonState[btnIndex]) {
              prevButtonState[btnIndex] = false;
              triggerKey(buttonToKeyMap[btnIndex], false);
            }
          });

          // Left Analog Stick to D-Pad mapping
          if (gp.axes.length >= 2) {
            const xAxis = gp.axes[0];
            const yAxis = gp.axes[1];
            const deadzone = 0.4;
            
            // Left (37) / Right (39)
            const isLeft = xAxis < -deadzone;
            const isRight = xAxis > deadzone;
            if (isLeft && !prevButtonState['axisLeft']) { prevButtonState['axisLeft'] = true; triggerKey({key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37}, true); }
            if (!isLeft && prevButtonState['axisLeft']) { prevButtonState['axisLeft'] = false; triggerKey({key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37}, false); }
            if (isRight && !prevButtonState['axisRight']) { prevButtonState['axisRight'] = true; triggerKey({key: 'ArrowRight', code: 'ArrowRight', keyCode: 39}, true); }
            if (!isRight && prevButtonState['axisRight']) { prevButtonState['axisRight'] = false; triggerKey({key: 'ArrowRight', code: 'ArrowRight', keyCode: 39}, false); }

            // Up (38) / Down (40)
            const isUp = yAxis < -deadzone;
            const isDown = yAxis > deadzone;
            if (isUp && !prevButtonState['axisUp']) { prevButtonState['axisUp'] = true; triggerKey({key: 'ArrowUp', code: 'ArrowUp', keyCode: 38}, true); }
            if (!isUp && prevButtonState['axisUp']) { prevButtonState['axisUp'] = false; triggerKey({key: 'ArrowUp', code: 'ArrowUp', keyCode: 38}, false); }
            if (isDown && !prevButtonState['axisDown']) { prevButtonState['axisDown'] = true; triggerKey({key: 'ArrowDown', code: 'ArrowDown', keyCode: 40}, true); }
            if (!isDown && prevButtonState['axisDown']) { prevButtonState['axisDown'] = false; triggerKey({key: 'ArrowDown', code: 'ArrowDown', keyCode: 40}, false); }
          }

          // Shortcuts (with cooldown)
          if (now - lastShortcutTime > 1000) {
            // L3 (10) + R3 (11) -> Virtual Start
            if (gp.buttons[10]?.pressed && gp.buttons[11]?.pressed) {
              simulateStart();
              lastShortcutTime = now;
            }
            
            // L1 (4) + R1 (5) + L2 (6) + R2 (7) -> Exit Game
            if (gp.buttons[4]?.pressed && gp.buttons[5]?.pressed && 
                gp.buttons[6]?.pressed && gp.buttons[7]?.pressed) {
              handleExit();
              lastShortcutTime = now;
            }
          }
          
          // We only process the first connected gamepad for these global shortcuts
          break;
        }
      }
      
      animationFrameId = requestAnimationFrame(pollGamepads);
    };
    
    animationFrameId = requestAnimationFrame(pollGamepads);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleExit = () => {
    // Reload page to clear WASM memory completely as OpenBOR isn't designed to be unmounted
    window.location.reload();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) { /* Safari */
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) { /* IE11 */
        containerRef.current.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
      }
    }
  };

  return (
    <div className="openbor-player-container">
      <div className="player-header">
        <h2>{game.title}</h2>
        <div className="header-actions">
          <button className="control-btn" onClick={() => {
            const canvas = document.getElementById('canvas');
            if (canvas) {
              const event = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
              canvas.dispatchEvent(event);
              setTimeout(() => {
                const upEvent = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true });
                canvas.dispatchEvent(upEvent);
              }, 100);
            }
          }}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Virtual Start
          </button>
          <button className="control-btn" onClick={toggleFullscreen}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
            Fullscreen
          </button>
          <button className="control-btn exit-btn" onClick={handleExit}>Exit Game</button>
        </div>
      </div>

      <div className="canvas-wrapper" ref={containerRef}>
        {loadState.status !== 'ready' && (
          <div className="loading-screen">
            <div className="spinner"></div>
            <h3>{loadState.message}</h3>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: `${loadState.progress}%` }}></div>
            </div>
          </div>
        )}
        
        {/* OpenBOR engine expects these IDs */}
        <div id="loading-overlay" style={{ display: 'none' }}>Loading...</div>
        <canvas id="canvas" tabIndex="1" style={{ display: loadState.status === 'ready' ? 'block' : 'none' }}></canvas>
        <div id="overlay"></div>
        <div id="buttons-overlay"></div>
      </div>
    </div>
  );
};

export default OpenBorPlayer;
