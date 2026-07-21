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
      // Clean up scripts and global variables if possible, though OpenBOR WASM might require a full reload
      // to completely clean up. For a simple SPA, forcing a reload on exit is safer.
      if (window.Module && window.Module.pauseMainLoop) {
         window.Module.pauseMainLoop();
      }
    };
  }, [game]);

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
