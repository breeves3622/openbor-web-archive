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
          contentPath: contentPath,
          paths: {
            assetsPaths: [], // We handle downloading ourselves to bypass ZIP requirement
            'OpenBOR.zip': contentPath + 'OpenBOR.zip',
            'game.css': contentPath + 'game.css',
            'main.js': contentPath + 'main.js',
            'mobile.js': contentPath + 'mobile.js',
          }
        };

        // Step 2: Inject main.js to load the WASM environment
        // We need to wait for Module and FS to be available
        const script = document.createElement('script');
        script.src = contentPath + 'main.js';
        script.async = true;
        
        const scriptPromise = new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load main.js"));
        });
        
        document.body.appendChild(script);
        await scriptPromise;

        // Step 3: Fetch the PAK from archive.org and mount it
        await downloadAndMountPak(game.pakUrl, (state) => {
          if (isMounted) setLoadState(state);
        });

        // Step 4: After mounting, if the engine needs a push to start, we can call it.
        // Usually, main.js starts automatically, but it might have been waiting for assetsPaths.
        // If it was waiting, we might need to trigger the run() function manually.
        if (window.Module && window.Module.removeRunDependency) {
          // main.js might add run dependencies for assets. If we didn't provide any, it might just start.
          console.log("Game loaded and mounted to FS.");
        }

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

  return (
    <div className="openbor-player-container">
      <div className="player-header">
        <h2>{game.title}</h2>
        <button className="exit-btn" onClick={handleExit}>Exit Game</button>
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
        <canvas id="canvas" tabIndex="1" style={{ display: loadState.status === 'ready' ? 'block' : 'none' }}></canvas>
        <div id="overlay"></div>
        <div id="buttons-overlay"></div>
      </div>
    </div>
  );
};

export default OpenBorPlayer;
