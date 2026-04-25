// Tiny image-loading helpers. Kept separate so every module can import the
// same two utilities instead of re-implementing the Image/Promise dance.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

export function loadFrames(folder, count) {
  const tasks = [];
  for (let i = 0; i < count; i++) {
    tasks.push(loadImage(`${folder}/frame-${i}.png`));
  }
  return Promise.all(tasks);
}
