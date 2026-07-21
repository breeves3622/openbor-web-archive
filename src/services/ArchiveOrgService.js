/**
 * Service to fetch a PAK file from Archive.org and load it into the Emscripten virtual file system.
 */

export const downloadAndMountPak = async (pakUrl, progressCallback) => {
  try {
    progressCallback({ status: 'fetching', message: 'Downloading game data from Archive.org...', progress: 0 });
    
    // Fetch the file with progress tracking using a CORS proxy
    const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(pakUrl)}`;
    const response = await fetch(proxiedUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch game: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    
    if (!total) {
      // If we don't have content-length, we can't show percentage, just download it
      progressCallback({ status: 'fetching', message: 'Downloading game data...', progress: 50 });
      const buffer = await response.arrayBuffer();
      return mountBufferToFS(buffer, progressCallback);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }
      
      chunks.push(value);
      receivedLength += value.length;
      
      const percent = Math.round((receivedLength / total) * 100);
      progressCallback({ status: 'fetching', message: `Downloading... ${percent}%`, progress: percent });
    }

    // Combine chunks into a single ArrayBuffer
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position);
      position += chunk.length;
    }

    return mountBufferToFS(chunksAll.buffer, progressCallback);

  } catch (error) {
    console.error("Error downloading PAK:", error);
    progressCallback({ status: 'error', message: error.message, progress: 0 });
    throw error;
  }
};

const mountBufferToFS = (buffer, progressCallback) => {
  progressCallback({ status: 'mounting', message: 'Mounting game to file system...', progress: 100 });
  
  return new Promise((resolve, reject) => {
    try {
      const data = new Uint8Array(buffer);
      
      // Wait for FS to be available from Emscripten
      const checkFS = setInterval(() => {
        if (window.FS) {
          clearInterval(checkFS);
          try {
            // Write to the virtual filesystem
            try { window.FS.mkdir('/Paks'); } catch(e) {} // ignore if already exists
            window.FS.writeFile('/Paks/game.pak', data);
            progressCallback({ status: 'ready', message: 'Game ready!', progress: 100 });
            resolve(true);
          } catch (e) {
            reject(e);
          }
        }
      }, 100);
      
      // Timeout after 10 seconds if FS doesn't appear
      setTimeout(() => {
        clearInterval(checkFS);
        reject(new Error("Emscripten FS not ready"));
      }, 10000);
      
    } catch (e) {
      reject(e);
    }
  });
};
