import {useId} from 'react';
import {cardSize, type CardDesign, type CardElement} from '../../../shared/businessCardDesign';
import type {BusinessCard} from './cardTools';

export function CardElementArtwork({element: el, card}: {element: CardElement; card: BusinessCard}) {
  const id = useId().replace(/:/g, '');
  if (el.kind === 'rect') return <rect width={el.width} height={el.height} fill={el.color}/>;
  if (el.kind === 'ellipse') return <ellipse cx={el.width / 2} cy={el.height / 2} rx={el.width / 2} ry={el.height / 2} fill={el.color}/>;
  if (el.kind === 'image') return <image href={el.src} width={el.width} height={el.height} preserveAspectRatio="xMidYMid meet"/>;
  const content = (el.binding ? card[el.binding] : el.text) || '';
  const fontSize = el.fontSize || 24;
  const x = el.align === 'center' ? el.width / 2 : el.align === 'right' ? el.width : 0;
  return <>
    <defs><clipPath id={id}><rect width={el.width} height={el.height}/></clipPath></defs>
    <text clipPath={`url(#${id})`} fill={el.color} fontFamily={el.font} fontSize={fontSize}
      fontWeight={el.bold ? 700 : 400} fontStyle={el.italic ? 'italic' : 'normal'}
      textAnchor={el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'}>
      {content.split('\n').map((line, i) => <tspan key={i} x={x} y={fontSize + i * fontSize * 1.3}>{line || '\u00a0'}</tspan>)}
    </text>
  </>;
}
export const elementTransform = (el: CardElement) => `translate(${el.x} ${el.y}) rotate(${el.rotation} ${el.width / 2} ${el.height / 2})`;
export default function CardArtwork({design, card, side = 'front'}: {design: CardDesign; card: BusinessCard; side?: 'front' | 'back'}) {
  const face = design[side];
  const {width, height} = cardSize(design.orientation);
  return <div className="mx-auto w-full" style={{maxWidth: `min(100%, calc(min(18rem, 100dvh - 10rem) * ${width} / ${height}))`}}><svg data-testid="card-design-artwork" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${card.name}の名刺・${side === 'front' ? '表面' : '裏面'}`} className="block w-full rounded-lg bg-white shadow-sm" style={{aspectRatio: `${width} / ${height}`}}>
    <rect width={width} height={height} fill={face.background}/>
    {face.elements.map(el => <g key={el.id} transform={elementTransform(el)} opacity={el.opacity}><CardElementArtwork element={el} card={card}/></g>)}
  </svg></div>;
}
