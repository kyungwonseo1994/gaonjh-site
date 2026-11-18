"use strict";

const copyButton = document.querySelector(".copy-email");
const emailLink = document.querySelector(".email-large");
const copyStatus = document.querySelector("#copy-status");
let resetButtonTimer;

async function copyEmail() {
  const address = emailLink.getAttribute("href").slice("mailto:".length);
  let copied = false;
  try {
    await navigator.clipboard.writeText(address);
    copied = true;
  } catch {
    // Also support local file previews and browsers that block clipboard access.
    const input = document.createElement("textarea");
    input.value = address;
    input.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.append(input);
    input.select();
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    input.remove();
    copyButton.focus({ preventScroll: true });
  }

  if (!copied) {
    const range = document.createRange();
    range.selectNodeContents(emailLink);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
  copyStatus.textContent = copied ? "메일 주소를 복사했습니다." : "메일 주소를 선택해 직접 복사해 주세요.";
  copyButton.textContent = copied ? "복사됨" : "주소 선택";
  clearTimeout(resetButtonTimer);
  resetButtonTimer = setTimeout(() => {
    copyButton.textContent = "주소 복사";
    copyStatus.textContent = "";
  }, 2200);
}

copyButton.hidden = false;
copyButton.addEventListener("click", copyEmail);

function animateCover() {
  const hero = document.querySelector(".hero");
  const canvas = hero.querySelector("canvas");
  const artwork = hero.querySelector(".artwork");
  const image = artwork.querySelector("img");
  const word = hero.querySelector(".cover-word");
  const baseline = word.querySelector(".baseline");
  const mast = document.querySelector(".mast");
  const ctx = canvas.getContext("2d");
  const desktop = matchMedia("(min-width:701px)");
  const reduced = matchMedia("(prefers-reduced-motion:reduce)");
  let field = null;
  let frame = 0;
  let visible = true;
  let progress = 0;
  let target = 0;
  let previousTime = 0;
  let measuredWidth = -1;
  let measuredHeight = -1;
  let fontsReady = false;

  const clamp = value => Math.min(1, Math.max(0, value));
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function buildField() {
    const bounds = hero.getBoundingClientRect();
    const artBounds = artwork.getBoundingClientRect();
    const textBounds = word.getBoundingClientRect();
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(bounds.width);
    mask.height = Math.max(1, Math.ceil(textBounds.bottom - bounds.top + 3));

    // Sample the same face, tracking, and baseline the browser uses for the poster.
    const brush = mask.getContext("2d", { willReadFrequently: true });
    const style = getComputedStyle(word);
    brush.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
    brush.letterSpacing = style.letterSpacing;
    brush.fillText("B–TEAM", textBounds.left - bounds.left, baseline.getBoundingClientRect().top - bounds.top);
    const pixels = brush.getImageData(0, 0, mask.width, mask.height).data;
    const destinations = [];
    for (let y = 1; y < mask.height - 1; y += 3) {
      for (let x = 1; x < mask.width - 1; x += 3) {
        const index = y * mask.width + x;
        if (pixels[index * 4 + 3] > 200) destinations.push(index);
      }
    }
    if (!destinations.length) return null;

    const aspect = Number(image.getAttribute("width")) / Number(image.getAttribute("height"));
    const width = Math.min(artBounds.width, artBounds.height * aspect);
    const height = width / aspect;
    const left = artBounds.right - bounds.left - width;
    const top = artBounds.bottom - bounds.top - height;
    const map = window.gaonPointMap;
    const bytes = atob(map.points);
    const groups = map.colors.map(hex => ({
      rgb: [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16)),
      points: []
    }));

    // Fixed sequences distribute the targets and trajectories identically in both scroll directions.
    for (let i = 0; i < bytes.length / 3; i++) {
      const destination = destinations[Math.floor((i * 0.61803398875 % 1) * destinations.length)];
      const group = groups[bytes.charCodeAt(i * 3 + 2)];
      group.points.push({
        x: left + bytes.charCodeAt(i * 3) / 255 * width,
        y: top + bytes.charCodeAt(i * 3 + 1) / 255 * height,
        endX: destination % mask.width,
        endY: Math.floor(destination / mask.width),
        delay: 0.13 * (i * 0.7548776662 % 1),
        phase: (i * 0.414213563 % 1) * Math.PI * 2
      });
    }
    return groups;
  }

  function layout() {
    cancelAnimationFrame(frame);
    frame = 0;
    progress = 0;
    previousTime = 0;
    field = null;
    image.style.removeProperty("opacity");
    hero.style.removeProperty("--word-opacity");
    hero.style.removeProperty("--word-travel");
    canvas.width = canvas.height = 1;
    hero.dataset.visual = "static";
    measuredWidth = hero.clientWidth;
    measuredHeight = hero.clientHeight;
    if (!fontsReady || !desktop.matches || reduced.matches || !ctx || !window.gaonPointMap) return;

    const density = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(1, Math.round(measuredWidth * density));
    canvas.height = Math.max(1, Math.round(measuredHeight * density));
    field = buildField();
    if (field) {
      hero.dataset.visual = "ready";
      followScroll();
    }
  }

  function paint(p) {
    ctx.setTransform(canvas.width / measuredWidth, 0, 0, canvas.height / measuredHeight, 0, 0);
    ctx.clearRect(0, 0, measuredWidth, measuredHeight);
    const travel = p * Math.min(100, measuredHeight * 0.13);
    hero.style.setProperty("--word-travel", travel + "px");
    hero.style.setProperty("--word-opacity", String(1 - 0.65 * Math.sin(Math.PI * p)));
    image.style.opacity = String(1 - ease(p / 0.40));
    if (p <= 0.003 || p >= 0.999) return;

    ctx.globalAlpha = ease(p / 0.20) * (1 - ease((p - 0.84) / 0.16));
    const ink = ease((p - 0.45) / 0.48);
    const spread = Math.min(80, measuredWidth * 0.048);
    const size = Math.max(1.65, measuredWidth * 0.00155);
    for (const group of field) {
      const color = group.rgb.map(channel => Math.round(channel + (27 - channel) * ink));
      ctx.fillStyle = "rgb(" + color.join(",") + ")";
      for (const point of group.points) {
        const t = ease((p - point.delay) / (1 - point.delay));
        const arc = Math.sin(Math.PI * t) * spread;
        const x = point.x + (point.endX - point.x) * t + arc * Math.sin(point.phase + t * 4);
        const y = point.y + (point.endY + travel - point.y) * t + arc * Math.cos(point.phase + t * 3);
        ctx.fillRect(x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function update(now) {
    frame = 0;
    if (!field || !visible) return;
    const elapsed = previousTime ? Math.min(64, now - previousTime) : 17;
    previousTime = now;
    progress += (target - progress) * (1 - Math.exp(-elapsed / 88));
    if (Math.abs(target - progress) < 0.001) progress = target;
    paint(progress);
    if (progress !== target) {
      frame = requestAnimationFrame(update);
    } else {
      previousTime = 0;
    }
  }

  function followScroll() {
    if (!field || !visible) return;
    const bounds = hero.getBoundingClientRect();
    target = clamp((mast.offsetHeight - bounds.top - 5) / Math.min(260, bounds.height * 0.34));
    if (!frame) frame = requestAnimationFrame(update);
  }

  addEventListener("scroll", followScroll, { passive: true });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) followScroll();
  }).observe(hero);
  new ResizeObserver(() => {
    if (measuredWidth !== hero.clientWidth || measuredHeight !== hero.clientHeight) layout();
  }).observe(hero);
  desktop.addEventListener("change", layout);
  reduced.addEventListener("change", layout);
  document.fonts.ready.then(() => {
    fontsReady = true;
    layout();
  });
}

animateCover();
