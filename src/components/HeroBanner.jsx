import { useEffect, useState } from 'react';
import './HeroBanner.css';

const unsplash = (id) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1920&q=80`;

// Hero photos (all free-to-use under the Unsplash License).
// Add or swap photos by changing the IDs (the part of the URL after "photo-").
const HERO_IMAGES = [
  unsplash('1758873269276-9518d0cb4a0b'), // your original photo
  unsplash('1758518730083-4c12527b6742'), // Vitaly Gariev: team meeting
  unsplash('1758691737568-a1572060ce5a'), // Vitaly Gariev: team discussion
  unsplash('1758876017801-f5a892ee460a'), // Vitaly Gariev: woman working on laptop
];

const SLIDE_MS = 7000;

export default function HeroBanner({ children }) {
  const [loaded, setLoaded] = useState([]); // urls that actually loaded
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Preload every image; only the ones that load become slides.
  useEffect(() => {
    let cancelled = false;
    HERO_IMAGES.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        if (!cancelled) setLoaded((prev) => (prev.includes(src) ? prev : [...prev, src]));
      };
      img.src = src;
    });
    return () => { cancelled = true; };
  }, []);

  // Keep the original order even though images finish loading at different times.
  const slides = HERO_IMAGES.filter((src) => loaded.includes(src));
  const current = slides.length ? active % slides.length : 0;

  useEffect(() => {
    if (slides.length < 2 || paused) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) setActive((i) => i + 1);
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  return (
    <section
      className="welcome-banner hero-slides"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hero-slides-layers" aria-hidden="true">
        {slides.map((src, i) => (
          <div
            key={src}
            className={`hero-slide${i === current ? ' is-active' : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>

      {children}

      {slides.length > 1 && (
        <div className="hero-dots">
          {slides.map((src, i) => (
            <button
              key={src}
              type="button"
              className={`hero-dot${i === current ? ' is-active' : ''}`}
              aria-label={`Show photo ${i + 1} of ${slides.length}`}
              aria-current={i === current}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}