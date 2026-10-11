import { getResponsiveImage } from './responsive-image.mjs';

const ARTICLE_SIZES = '(max-width: 840px) 100vw, 800px';

function visit(node, fn) {
  fn(node);
  if (node.children) for (const child of node.children) visit(child, fn);
}

/** Serves Markdown body images from the optimized WebP variants and lazy-loads them. */
export default function rehypeResponsiveImages() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'img') return;
      const props = node.properties ?? (node.properties = {});
      const original = typeof props.src === 'string' ? props.src : '';
      if (original.startsWith('/')) {
        const image = getResponsiveImage(original);
        if (image.srcset) {
          props.src = image.src;
          props.srcSet = image.srcset;
          props.sizes ??= ARTICLE_SIZES;
          if (props.width == null && props.height == null) {
            props.width = image.width;
            props.height = image.height;
          }
        }
      }
      props.loading ??= 'lazy';
      props.decoding ??= 'async';
    });
  };
}
