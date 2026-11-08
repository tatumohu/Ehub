/** Shared document format. Legacy documents without orientation use landscape. */
export type CardBinding = 'name' | 'company' | 'role' | 'email' | 'phone' | 'website';
export type CardElement = {
  id: string;
  kind: 'text' | 'rect' | 'ellipse' | 'image';
  x: number; y: number; width: number; height: number; rotation: number;
  color: string; opacity: number;
  text?: string; binding?: CardBinding; field?: CardBinding; fontSize?: number;
  font?: 'sans-serif' | 'serif' | 'monospace'; bold?: boolean;
  italic?: boolean; align?: 'left' | 'center' | 'right';
  src?: string;
};
export type CardFace = { background: string; elements: CardElement[] };
export type CardOrientation = 'landscape' | 'portrait';
export type CardDesign = { version: 1; orientation?: CardOrientation; front: CardFace; back: CardFace };
export const CARD_WIDTH = 910, CARD_HEIGHT = 550;
export function cardSize(orientation?: CardOrientation) {
  return orientation === 'portrait' ? {width: CARD_HEIGHT, height: CARD_WIDTH} : {width: CARD_WIDTH, height: CARD_HEIGHT};
}
export const bindings: CardBinding[] = ['name', 'company', 'role', 'email', 'phone', 'website'];
const hex = /^#[0-9a-f]{6}$/i;
export function isCardImage(value: unknown): value is string {
  return typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}
export function validateCardDesign(value: unknown): CardDesign | null {
  if (value == null) return null;
  const invalid = (): never => { throw new Error('名刺デザインの形式が不正です。'); };
  if (JSON.stringify(value).length > 8_000_000) throw new Error('デザインの画像が大きすぎます。画像を減らしてください。');
  const number = (n: unknown, min: number, max: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) invalid();
    return n as number;
  };
  const color = (v: unknown) => { if (typeof v !== 'string' || !hex.test(v)) invalid(); return v as string; };
  const doc = value as CardDesign;
  if (doc.version !== 1 || (doc.orientation !== undefined && !['landscape', 'portrait'].includes(doc.orientation))) invalid();
  const {width, height} = cardSize(doc.orientation);
  const face = (f: CardFace): CardFace => {
    if (!f || !Array.isArray(f.elements) || f.elements.length > 50) invalid();
    const ids = new Set<string>();
    return { background: color(f.background), elements: f.elements.map(el => {
      if (!el || typeof el.id !== 'string' || !/^[\w-]{1,80}$/.test(el.id) || ids.has(el.id)) invalid();
      ids.add(el.id);
      if (!['text', 'rect', 'ellipse', 'image'].includes(el.kind)) invalid();
      const result: CardElement = {
        id: el.id, kind: el.kind,
        x: number(el.x, 0, width - 8), y: number(el.y, 0, height - 8),
        width: number(el.width, 8, width), height: number(el.height, 8, height),
        rotation: number(el.rotation, -180, 180), color: color(el.color), opacity: number(el.opacity, 0.1, 1),
      };
      if (result.x + result.width > width + 0.01 || result.y + result.height > height + 0.01) invalid();
      if (el.kind === 'text') {
        if (typeof el.text !== 'string' || el.text.length > 2000) invalid();
        if (el.binding !== undefined && !bindings.includes(el.binding)) invalid();
        if (el.field !== undefined && !bindings.includes(el.field)) invalid();
        if (!['sans-serif', 'serif', 'monospace'].includes(el.font!)) invalid();
        if (!['left', 'center', 'right'].includes(el.align!)) invalid();
        if (typeof el.bold !== 'boolean' || typeof el.italic !== 'boolean') invalid();
        Object.assign(result, { text: el.text, fontSize: number(el.fontSize, 8, 160), font: el.font,
          align: el.align, bold: el.bold, italic: el.italic, ...(el.binding ? {binding: el.binding} : {}), ...(el.field ? {field: el.field} : {}) });
      }
      if (el.kind === 'image') {
        if (!isCardImage(el.src) || el.src.length > 2_500_000) invalid();
        result.src = el.src;
      }
      return result;
    }) };
  };
  return { version: 1, orientation: doc.orientation || 'landscape', front: face(doc.front), back: face(doc.back) };
}
export function initialCardDesign(template: 'basic' | 'band' | 'blank' = 'basic', orientation: CardOrientation = 'landscape'): CardDesign {
  const {width, height} = cardSize(orientation);
  const text = (id: CardBinding, x: number, y: number, size: number, height = 42): CardElement => ({
    id, kind: 'text', x, y, width: width - 170, height, rotation: 0, color: '#0f172a', opacity: 1,
    binding: id, text: '', fontSize: size, font: 'sans-serif', bold: id === 'name', italic: false, align: 'left',
  });
  return { version: 1, orientation, front: { background: '#ffffff', elements: template === 'blank' ? [] : [
    {id: 'accent', kind: 'rect', x: 0, y: 0, width: template === 'band' ? 55 : width,
      height: template === 'band' ? height : 12, rotation: 0, color: '#2563eb', opacity: 1},
    text('name', 85, 142 * height / CARD_HEIGHT, 50, 80),
  ] }, back: {background: '#ffffff', elements: []} };
}

/** Keep content upright. Only oversized elements shrink; neither face is discarded. */
export function changeCardOrientation(design: CardDesign, orientation: CardOrientation): CardDesign {
  if ((design.orientation || 'landscape') === orientation) return design;
  const old = cardSize(design.orientation), next = cardSize(orientation);
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
  const transform = (face: CardFace): CardFace => ({...face, elements: face.elements.map(el => {
    const fullWidth = el.rotation === 0 && el.kind === 'rect' && el.x === 0 && el.width === old.width;
    const fullHeight = el.rotation === 0 && el.kind === 'rect' && el.y === 0 && el.height === old.height;
    const angle = el.rotation * Math.PI / 180;
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const visualWidth = Math.max(el.width, el.width * cos + el.height * sin);
    const visualHeight = Math.max(el.height, el.width * sin + el.height * cos);
    const scale = Math.min(1, fullWidth ? 1 : (next.width - 60) / visualWidth, fullHeight ? 1 : (next.height - 60) / visualHeight);
    const width = fullWidth ? next.width : Math.max(8, el.width * scale);
    const height = fullHeight ? next.height : Math.max(8, el.height * scale);
    const halfWidth = Math.max(width, width * cos + height * sin) / 2;
    const halfHeight = Math.max(height, width * sin + height * cos) / 2;
    return {...el, width, height,
      x: fullWidth || (fullHeight && el.x === 0) ? 0 : clamp((el.x + el.width / 2) / old.width * next.width - halfWidth, next.width - 2 * halfWidth) + halfWidth - width / 2,
      y: fullHeight || (fullWidth && el.y === 0) ? 0 : clamp((el.y + el.height / 2) / old.height * next.height - halfHeight, next.height - 2 * halfHeight) + halfHeight - height / 2,
      ...(el.kind === 'text' ? {fontSize: Math.max(8, el.fontSize! * scale)} : {}),
    };
  })});
  return {...design, orientation, front: transform(design.front), back: transform(design.back)};
}
