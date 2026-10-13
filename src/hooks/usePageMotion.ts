import { useEffect } from 'react';
import { useMotionPreference } from './useMotionPreference';

// Progressive enhancement: all content remains visible without this observer.
export function usePageMotion() {
  const reduced = useMotionPreference();
  useEffect(() => {
    const elements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    if (reduced) {
      elements.forEach(element => element.classList.remove('is-awaiting-reveal'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove('is-awaiting-reveal');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    elements.forEach(element => {
      if (element.getBoundingClientRect().top > innerHeight) {
        element.classList.add('is-awaiting-reveal');
        observer.observe(element);
      }
    });
    return () => {
      observer.disconnect();
      elements.forEach(element => element.classList.remove('is-awaiting-reveal'));
    };
  }, [reduced]);
}
